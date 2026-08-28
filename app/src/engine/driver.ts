/**
 * Session turn orchestration lifted from ticket 02's validated prototype.
 * Deterministic, app-driven beat loop over the ticket-01 engine primitives
 * (`../participant-interfaces/engine.ts`). Pure, DOM-free, dependency-free.
 * Mock/scripted runtimes plug in here; the real Vercel-AI-SDK-backed runtime
 * plugs in at exactly the same seam. The validated version lifts into the
 * Next.js app's engine layer.
 *
 * Decisions implemented (issues/02-turn-orchestration.md ## Answer):
 *   1. Triggers derive purely from event structure; audience = addressing.
 *   2. Volunteering is model-decided (required Reaction, optional utterance).
 *   3. One model call = at most one utterance + one Reaction, atomic.
 *   4. Sequential model calls in fixed seat order; log order = speaking order.
 *   5. Volunteering cascade capped at one consideration per party per beat.
 *   6. Caucus: explicit open/close, joint-visible bookends, gated content.
 *   7. Threshold-forced responses are mandatory-speak; silence is loud.
 *   8. Transactional turns; one bounded auto-retry for transport errors.
 *   9. Offers are structured events; `position` is app-applied, never model-written.
 *  10. Seven phases; 11. human-issued transitions (walkout is system-forced).
 */

import {
  type Session,
  type MediationEvent,
  type PartyRuntime,
  type Reaction,
  type NegotiationState,
  type ModelConfig,
  appendEvent,
  applyPartyReaction,
  projectFor,
  mediatorId,
  caucusAudience,
  jointAudience,
} from "./domain.ts";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Phases (decision 10: seven collapsed phases)
// ---------------------------------------------------------------------------

export type Phase =
  | "setup"
  | "joint_session"
  | "caucus"
  | "agreement"
  | "impasse"
  | "walkout"
  | "review";

// ---------------------------------------------------------------------------
// Model seam (extends ticket 01's ModelRuntime with decision 9's structured offer)
// ---------------------------------------------------------------------------

export interface Offer {
  amount: number;
  terms?: string;
}

export interface AgentResponse {
  /** May be "" (declined to speak); a Reaction is always required. */
  utterance: string;
  reaction: Reaction;
  offer?: Offer;
}

export interface DriverRuntime {
  readonly config: ModelConfig;
  respond(input: {
    projection: readonly MediationEvent[];
    runtime: PartyRuntime;
    /** True for threshold-forced responses: the model must speak. */
    mandatory: boolean;
  }): Promise<AgentResponse>;
}

// ---------------------------------------------------------------------------
// Scenario rules (decisions 7 + 11): threshold hooks the driver evaluates
// after every applied Reaction. force_speak → mandatory-speak consideration;
// walkout → the one system-forced phase transition (PARTY_WALKS_OUT).
// ---------------------------------------------------------------------------

type MutableDimension =
  | "anger" | "trustMediator" | "trustOtherParty"
  | "willingnessToSettle" | "rigidity" | "fatigue";

export interface ScenarioRule<T extends string> {
  partyId: T;
  dimension: MutableDimension;
  op: "<" | ">";
  threshold: number;
  effect: "force_speak" | "walkout";
}

// ---------------------------------------------------------------------------
// Driver errors (decision 8: failures are loud and transactional)
// ---------------------------------------------------------------------------

export type TurnErrorKind = "transport" | "structural" | "mandatory_silent" | "phase" | "seat";

export class TurnError extends Error {
  readonly kind: TurnErrorKind;
  constructor(kind: TurnErrorKind, message: string) {
    super(message);
    this.name = "TurnError";
    this.kind = kind;
  }
}

function isTransportError(e: unknown): boolean {
  return e instanceof TurnError && e.kind === "transport";
}

const reactionSchema = z.object({
  angerDelta: z.number().finite().optional(),
  trustMediatorDelta: z.number().finite().optional(),
  trustOtherPartyDelta: z.number().finite().optional(),
  willingnessToSettleDelta: z.number().finite().optional(),
  rigidityDelta: z.number().finite().optional(),
  fatigueDelta: z.number().finite().optional(),
});

const agentResponseSchema = z.object({
  utterance: z.string(),
  reaction: reactionSchema,
  offer: z.object({ amount: z.number().finite().nonnegative(), terms: z.string().optional() }).optional(),
});

/** Audit: every model-call attempt, including failed ones (decision 8). */
export interface InvocationAttempt<T extends string> {
  seatId: T;
  attempt: number;
  ok: boolean;
  mandatory: boolean;
  promptVersion: string;
  visibleEventIds: string[];
  stateBefore: NegotiationState;
  stateAfter: NegotiationState;
  response?: AgentResponse;
  error?: string;
}

interface Consideration<T extends string> {
  partyId: T;
  mandatory: boolean;
  /** True when this call exists because the *other* party just spoke. */
  viaVolunteering: boolean;
}

// ---------------------------------------------------------------------------
// The driver
// ---------------------------------------------------------------------------

export class TurnDriver<T extends string> {
  session: Session<T>;
  private fallbackPhase: Phase = "setup";
  private phaseOwner?: () => Phase;
  private pendingWalkout: T | null = null;
  /** Human-readable beat trace (the HTML mirror renders this). */
  readonly trace: string[] = [];
  /** Every model-call attempt, success or failure. */
  readonly invocations: InvocationAttempt<T>[] = [];

  private readonly models: Partial<Record<T, DriverRuntime>>;
  private readonly rules: readonly ScenarioRule<T>[];
  private readonly promptVersion: string;

  constructor(
    session: Session<T>,
    models: Partial<Record<T, DriverRuntime>>,
    rules: readonly ScenarioRule<T>[] = [],
    promptVersion = "proto-02"
  ) {
    this.session = session;
    this.models = models;
    this.rules = rules;
    this.promptVersion = promptVersion;
  }

  /** XState installs itself as phase owner; fallback preserves the prototype smoke harness. */
  attachPhaseOwner(read: () => Phase): void {
    this.phaseOwner = read;
  }

  get phase(): Phase {
    return this.phaseOwner?.() ?? this.fallbackPhase;
  }

  consumeSystemWalkout(): T | null {
    const partyId = this.pendingWalkout;
    this.pendingWalkout = null;
    return partyId;
  }

  // -- mediator actions (this is the UI's action surface) ------------------

  /** setup → joint_session. Appends a joint-visible opening session_event. */
  openSession(): this {
    this.requirePhase("setup", "openSession");
    this.session = appendEvent(this.session, {
      sender: "SYSTEM",
      audience: jointAudience(this.session),
      kind: "session_event",
      payload: { type: "session_opened" },
    });
    this.fallbackPhase = "joint_session";
    this.trace.push("phase → joint_session");
    return this;
  }

  /** Mediator speaks. `audience` IS the addressing (decision 1). */
  async send(audience: T[], text: string, kind: "message" | "offer" = "message"): Promise<this> {
    const z = this.requireMediator();
    this.requirePhaseIn(["joint_session", "caucus"], "send");
    if (this.phase === "caucus") {
      const caucus = caucusAudience(this.session, this.session.caucusWith!);
      const leaked = audience.filter((a) => !caucus.includes(a));
      if (leaked.length) {
        throw new TurnError("phase", `cannot address ${leaked.join(", ")} during a private caucus`);
      }
    }
    // The sender-must-be-in-own-audience rule: Z always hears what Z says.
    const fullAudience = [...new Set([...audience, z])] as T[];
    this.session = appendEvent(this.session, {
      sender: z,
      audience: fullAudience,
      kind,
      payload: { text },
    });
    this.trace.push(`Z → [${audience.join(", ")}]: "${text}"`);
    const addressed = this.partyIdsInSeatOrder().filter(
      (p) => audience.includes(p) && this.canSpeakNow(p)
    );
    await this.runBeats(addressed);
    return this;
  }

  /** Decision 6: explicit open; the bookend is joint-visible, content gated. */
  openCaucus(partyId: T): this {
    this.requirePhase("joint_session", "openCaucus");
    caucusAudience(this.session, partyId); // validates the party seat
    this.session = appendEvent(this.session, {
      sender: this.requireMediator(),
      audience: jointAudience(this.session),
      kind: "session_event",
      payload: { type: "caucus_begin", party: partyId },
    });
    this.session = { ...this.session, caucusWith: partyId };
    this.fallbackPhase = "caucus";
    this.trace.push(`phase → caucus (with ${partyId})`);
    return this;
  }

  closeCaucus(): this {
    const partyId = this.session.caucusWith;
    if (this.phase !== "caucus" || !partyId) {
      throw new TurnError("phase", "closeCaucus requires an active caucus");
    }
    this.session = appendEvent(this.session, {
      sender: this.requireMediator(),
      audience: jointAudience(this.session),
      kind: "session_event",
      payload: { type: "caucus_end", party: partyId },
    });
    this.session = { ...this.session, caucusWith: null };
    this.fallbackPhase = "joint_session";
    this.trace.push("phase → joint_session");
    return this;
  }

  /** Decision 11: human-issued transitions (walkout is the only system-forced one). */
  declareAgreement(): this {
    this.requirePhase("joint_session", "declareAgreement");
    return this.endSession("agreement");
  }

  declareImpasse(): this {
    this.requirePhase("joint_session", "declareImpasse");
    return this.endSession("impasse");
  }

  enterReview(): this {
    this.requirePhaseIn(["agreement", "impasse", "walkout"], "enterReview");
    this.fallbackPhase = "review";
    this.trace.push("phase → review");
    return this;
  }

  // -- beat loop -------------------------------------------------------------

  /**
   * The beat loop (decisions 1–5): sequential in seat order, one call per
   * consideration, one round-trip volunteering cap, scenario rules evaluated
   * after each applied Reaction, walkout as the one system-forced transition.
   */
  private async runBeats(addressedPartyIds: T[]): Promise<void> {
    const frontier: Consideration<T>[] = addressedPartyIds.map((partyId) => ({
      partyId,
      mandatory: false,
      viaVolunteering: false,
    }));
    const volunteered = new Set<T>(); // decision 5: one consideration per party per beat
    const forcedFired = new Set<string>();

    while (frontier.length) {
      if (this.phase !== "joint_session" && this.phase !== "caucus") return;
      const c = frontier.shift()!;
      const response = await this.callSeat(c); // transactional; failures are loud

      const inCaucus = this.phase === "caucus";
      const audience = inCaucus
        ? caucusAudience(this.session, this.session.caucusWith!)
        : jointAudience(this.session);

      let next = this.session;
      if (response.offer) {
        next = appendEvent(next, {
          sender: c.partyId,
          audience,
          kind: "offer",
          payload: response.offer,
        });
        // Decision 9: position updates are an app-side effect of the offer
        // event — never written through the Reaction channel.
        next = this.updateNegotiation(next, c.partyId, (n) => ({
          ...n,
          position: response.offer!.amount,
        }));
      }
      const spoke = response.utterance.trim().length > 0;
      if (spoke) {
        next = appendEvent(next, {
          sender: c.partyId,
          audience,
          kind: "message",
          payload: { text: response.utterance },
        });
      } else if (c.mandatory) {
        throw new TurnError(
          "mandatory_silent",
          `${c.partyId} declined a threshold-forced response — nothing appended`
        );
      }
      // Apply the Reaction to behavioral state (ticket-01 reducer).
      next = this.updateNegotiation(next, c.partyId, (n) =>
        applyPartyReaction(n, response!.reaction)
      );
      this.session = next;

      // Scenario rules fire after the Reaction lands (decisions 7 + 11).
      for (const rule of this.rules) {
        if (rule.partyId !== c.partyId) continue;
        const value = next.runtimes[c.partyId]!.negotiation[rule.dimension];
        const fires = rule.op === "<" ? value < rule.threshold : value > rule.threshold;
        if (!fires) continue;
        const key = `${rule.partyId}:${rule.dimension}:${rule.effect}`;
        if (forcedFired.has(key)) continue;
        forcedFired.add(key);
        if (rule.effect === "walkout") {
          this.systemWalkout(rule.partyId);
          return; // the one system-forced transition; the beat is over
        }
        // Priority: forced responses precede pending volunteering calls.
        frontier.unshift({ partyId: rule.partyId, mandatory: true, viaVolunteering: false });
      }

      // Decisions 2 + 5: volunteering, capped at one consideration per party
      // per beat, joint session only.
      if (spoke && this.phase === "joint_session") {
        for (const other of this.partyIdsInSeatOrder()) {
          if (other === c.partyId) continue;
          if (volunteered.has(other)) continue;
          volunteered.add(other);
          frontier.push({ partyId: other, mandatory: false, viaVolunteering: true });
        }
      }
    }
  }

  /**
   * Transactional seat call (decisions 3, 7, 8): validate → append → reduce;
   * any failure lands nothing. One bounded auto-retry for transport errors,
   * both attempts audited. Structural failures surface with no retry.
   */
  private async callSeat(c: Consideration<T>): Promise<AgentResponse> {
    const model = this.models[c.partyId];
    if (!model) throw new TurnError("seat", `no model runtime for ${c.partyId}`);
    const rt = this.session.runtimes[c.partyId];
    if (!rt) throw new TurnError("structural", `no party runtime for ${c.partyId}`);
    const projection = projectFor(this.session, c.partyId);
    const visibleEventIds = projection.map((e) => e.id);
    const stateBefore = rt.negotiation;

    let response: AgentResponse | undefined;
    let attempts = 0;
    let lastError: unknown;
    while (attempts < 2) {
      attempts++;
      try {
        response = await model.respond({ projection, runtime: rt, mandatory: c.mandatory });
        lastError = undefined;
        break;
      } catch (e) {
        lastError = e;
        this.invocations.push({
          seatId: c.partyId,
          attempt: attempts,
          ok: false,
          mandatory: c.mandatory,
          promptVersion: this.promptVersion,
          visibleEventIds,
          stateBefore,
          stateAfter: stateBefore,
          error: e instanceof Error ? e.message : String(e),
        });
        if (!isTransportError(e)) break; // structural: no auto-retry (decision 8)
      }
    }
    if (!response) {
      const kind = isTransportError(lastError) ? "transport" : "structural";
      throw new TurnError(
        kind,
        `model call failed for ${c.partyId} after ${attempts} attempt(s): ${String(lastError)}`
      );
    }
    const parsed = agentResponseSchema.safeParse(response);
    if (!parsed.success) {
      throw new TurnError("structural", `invalid agent response: ${parsed.error.message}`);
    }
    response = parsed.data;
    if (attempts > 1) {
      this.trace.push(`${c.partyId}: transport retry succeeded on attempt ${attempts}`);
    }
    if (!response.utterance.trim() && c.mandatory) {
      // Decision 7: silence on a forced response is loud, not silent.
      throw new TurnError("mandatory_silent", `${c.partyId} declined a mandatory response`);
    }
    this.invocations.push({
      seatId: c.partyId,
      attempt: attempts,
      ok: true,
      mandatory: c.mandatory,
      promptVersion: this.promptVersion,
      visibleEventIds,
      stateBefore,
      stateAfter: applyPartyReaction(stateBefore, response.reaction),
      response,
    });
    return response;
  }

  // -- private helpers -------------------------------------------------------

  private systemWalkout(partyId: T): void {
    this.session = appendEvent(this.session, {
      sender: "SYSTEM",
      audience: jointAudience(this.session),
      kind: "session_event",
      payload: { type: "walkout", party: partyId },
    });
    this.fallbackPhase = "walkout";
    this.pendingWalkout = partyId;
    this.trace.push(`phase → walkout (${partyId}) — system-forced by scenario rule`);
  }

  private endSession(phase: "agreement" | "impasse"): this {
    this.session = appendEvent(this.session, {
      sender: this.requireMediator(),
      audience: jointAudience(this.session),
      kind: "session_event",
      payload: { type: `declared_${phase}` },
    });
    this.fallbackPhase = phase;
    this.trace.push(`phase → ${phase}`);
    return this;
  }

  private updateNegotiation(
    session: Session<T>,
    partyId: T,
    fn: (n: NegotiationState) => NegotiationState
  ): Session<T> {
    const rt = session.runtimes[partyId]!;
    return {
      ...session,
      runtimes: {
        ...session.runtimes,
        [partyId]: { ...rt, negotiation: fn(rt.negotiation) },
      },
    };
  }

  /** Caucus gate, at driver level: only seats that may act get considerations. */
  private canSpeakNow(seatId: T): boolean {
    if (this.phase === "caucus") {
      const caucus = caucusAudience(this.session, this.session.caucusWith!);
      return caucus.includes(seatId);
    }
    return true;
  }

  private partyIdsInSeatOrder(): T[] {
    return this.session.seats.filter((s) => s.role === "party").map((s) => s.id as T);
  }

  private requireMediator(): T {
    const z = mediatorId(this.session);
    if (!z) throw new TurnError("seat", "no mediator seat configured");
    return z;
  }

  private requirePhase(phase: Phase, action: string): void {
    if (this.phase !== phase) {
      throw new TurnError("phase", `${action} requires phase "${phase}", got "${this.phase}"`);
    }
  }

  private requirePhaseIn(phases: Phase[], action: string): void {
    if (!phases.includes(this.phase)) {
      throw new TurnError("phase", `${action} requires one of [${phases.join(", ")}], got "${this.phase}"`);
    }
  }
}
