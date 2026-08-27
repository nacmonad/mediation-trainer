import { createActor, fromCallback, setup, type ActorRefFrom, type SnapshotFrom } from "xstate";
import { z } from "zod";

import type { Session } from "./domain";
import { TurnDriver, type Phase } from "./driver";

const seatId = z.string().min(1);

/** Human/proposer input. PARTY_WALKS_OUT is deliberately absent: it is system-only. */
export const sessionInputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("OPEN_SESSION") }),
  z.object({ type: z.literal("SEND"), audience: z.array(seatId).min(1), text: z.string().min(1) }),
  z.object({ type: z.literal("OPEN_CAUCUS"), partyId: seatId }),
  z.object({ type: z.literal("CLOSE_CAUCUS") }),
  z.object({ type: z.literal("DECLARE_AGREEMENT") }),
  z.object({ type: z.literal("DECLARE_IMPASS") }),
  z.object({ type: z.literal("ENTER_REVIEW") }),
]);

export type SessionInput = z.infer<typeof sessionInputSchema>;
type MachineEvent = SessionInput | { type: "PARTY_WALKS_OUT"; partyId: string };

/** Party runtime children are mailbox actors, deliberately not state machines. */
const partyRuntimeActor = fromCallback(({ input }: { input: { seatId: string } }) => {
  void input.seatId;
  return () => undefined;
});

const sessionMachine = setup({
  types: {} as {
    context: { partyRuntimes: ActorRefFrom<typeof partyRuntimeActor>[] };
    events: MachineEvent;
    input: { partyIds: string[] };
  },
  actors: { partyRuntime: partyRuntimeActor },
}).createMachine({
  context: ({ input, spawn }) => ({
    partyRuntimes: input.partyIds.map((seatId) =>
      spawn("partyRuntime", { id: `party-runtime-${seatId}`, input: { seatId } })
    ),
  }),
  initial: "setup",
  states: {
    setup: { on: { OPEN_SESSION: "joint_session" } },
    joint_session: {
      on: {
        SEND: {},
        OPEN_CAUCUS: "caucus",
        DECLARE_AGREEMENT: "agreement",
        DECLARE_IMPASS: "impasse",
        PARTY_WALKS_OUT: "walkout",
      },
    },
    caucus: {
      on: {
        SEND: {},
        CLOSE_CAUCUS: "joint_session",
        PARTY_WALKS_OUT: "walkout",
      },
    },
    agreement: { on: { ENTER_REVIEW: "review" } },
    impasse: { on: { ENTER_REVIEW: "review" } },
    walkout: { on: { ENTER_REVIEW: "review" } },
    review: { type: "final" },
  },
});

export type SessionActorSnapshot = SnapshotFrom<typeof sessionMachine>;

/**
 * XState owns the Session phase. The plain-TypeScript driver owns the event log,
 * projections, behavioral state, and beat loop. All external inputs cross this
 * one typed dispatch seam, which a later LLM transition proposer can reuse.
 */
export class SessionActor<T extends string> {
  private readonly actor;

  constructor(readonly driver: TurnDriver<T>) {
    const partyIds = driver.session.seats
      .filter((seat) => seat.role === "party" && seat.kind === "agent")
      .map((seat) => seat.id);
    this.actor = createActor(sessionMachine, { input: { partyIds } }).start();
    driver.attachPhaseOwner(() => this.phase);
  }

  get phase(): Phase {
    return this.actor.getSnapshot().value as Phase;
  }

  get session(): Session<T> {
    return this.driver.session;
  }

  subscribe(listener: (snapshot: SessionActorSnapshot) => void): () => void {
    const subscription = this.actor.subscribe(listener);
    return () => subscription.unsubscribe();
  }

  async dispatch(untrustedInput: unknown): Promise<void> {
    const event = sessionInputSchema.parse(untrustedInput) as SessionInput;
    switch (event.type) {
      case "OPEN_SESSION":
        this.driver.openSession();
        break;
      case "SEND":
        await this.driver.send(event.audience as T[], event.text);
        const walkoutPartyId = this.driver.consumeSystemWalkout();
        if (walkoutPartyId) {
          this.actor.send({ type: "PARTY_WALKS_OUT", partyId: walkoutPartyId });
          return;
        }
        break;
      case "OPEN_CAUCUS":
        this.driver.openCaucus(event.partyId as T);
        break;
      case "CLOSE_CAUCUS":
        this.driver.closeCaucus();
        break;
      case "DECLARE_AGREEMENT":
        this.driver.declareAgreement();
        break;
      case "DECLARE_IMPASS":
        this.driver.declareImpasse();
        break;
      case "ENTER_REVIEW":
        this.driver.enterReview();
        break;
    }
    this.actor.send(event);
    if (this.phase !== this.driver.phase) {
      throw new Error(`session phase invariant failed: actor=${this.phase}, driver=${this.driver.phase}`);
    }
  }
}
