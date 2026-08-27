/**
 * PROTOTYPE — ticket 02 smoke test. Run: `node smoke.ts`
 * Proves the beat-loop decisions against a scripted mock runtime.
 */

import {
  createSession,
  projectFor,
  type AgentSeat,
  type SeatConfig,
} from "../participant-interfaces/engine.ts";
import {
  TurnDriver,
  TurnError,
  type DriverRuntime,
  type AgentResponse,
  type ScenarioRule,
} from "./driver.ts";

type Id = "A" | "B" | "Z";

// -- assertion helpers -------------------------------------------------------

let passed = 0;
let failed = 0;

function ok(name: string, cond: boolean, detail = ""): void {
  if (cond) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failed++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

// -- scripted mock runtime (Phase-0 stand-in for ModelRuntime) ----------------

class ScriptedRuntime implements DriverRuntime {
  readonly config = { provider: "ollama" as const, model: "scripted-mock" };
  private index = 0;
  private failuresRemaining: number;
  failuresUsed = 0;

  readonly seatId: Id;
  private readonly script: readonly (AgentResponse | Error)[];
  private index = 0;
  private failuresRemaining: number;
  failuresUsed = 0;

  constructor(
    seatId: Id,
    script: readonly (AgentResponse | Error)[],
    transportFailures = 0
  ) {
    this.seatId = seatId;
    this.script = script;
    this.failuresRemaining = transportFailures;
  }

  respond(_input: { mandatory: boolean }): Promise<AgentResponse> {
    if (this.failuresRemaining > 0) {
      this.failuresRemaining--;
      this.failuresUsed++;
      return Promise.reject(
        new TurnError("transport", `${this.seatId}: simulated transport failure`)
      );
    }
    const step = this.script[this.index++] ?? { utterance: "", reaction: {} };
    if (step instanceof Error) return Promise.reject(step);
    return Promise.resolve(step);
  }
}

// -- scenario scaffolding -----------------------------------------------------

const agentSeat = (id: Id): AgentSeat => ({
  id,
  role: "party",
  kind: "agent",
  model: { provider: "ollama", model: "scripted" },
});

const humanSeat = (id: Id) => ({ id, role: "mediator", kind: "human" }) as const;

function makeDriver(
  aScript: readonly (AgentResponse | Error)[],
  bScript: readonly (AgentResponse | Error)[],
  rules: readonly ScenarioRule<Id>[] = [],
  aFailures = 0
) {
  const seats: readonly SeatConfig[] = [agentSeat("A"), agentSeat("B"), humanSeat("Z")];
  const session = createSession<Id>(seats, {
    A: { anger: 20, willingnessToSettle: 60 },
    B: { anger: 40, willingnessToSettle: 20 },
  });
  const a = new ScriptedRuntime("A", aScript, aFailures);
  const b = new ScriptedRuntime("B", bScript);
  const driver = new TurnDriver<Id>(session, { A: a, B: b }, rules);
  return { driver, a, b };
}

const senders = (driver: TurnDriver<Id>): string[] =>
  driver.session.log.map((e) => `${e.sender}:${e.kind}`);

async function main(): Promise<void> {
  console.log("smoke: turn-model driver (ticket 02)\n");

  // ------------------------------------------------------------------ 1
  console.log("1. sequential ordering + declined volunteering (decisions 2, 4)");
  {
    const { driver } = makeDriver(
      [{ utterance: "We demand 120k.", reaction: { angerDelta: -5 } }],
      [{ utterance: "", reaction: { trustMediatorDelta: 2 } }] // B declines to volunteer
    );
    driver.openSession();
    await driver.send(["A", "B"], "Let's begin. State your positions.");
    ok(
      "Z message → A response; B declines (no event)",
      senders(driver).join("|") === "SYSTEM:session_event|Z:message|A:message",
      senders(driver).join(" → ")
    );
    const bCall = driver.invocations.filter((i) => i.seatId === "B").at(-1);
    ok(
      "B's consideration saw A's landed utterance (projection = 3 events)",
      bCall !== undefined && bCall.visibleEventIds.length === 3,
      `saw ${bCall?.visibleEventIds.length ?? "?"}`
    );
    ok(
      "declined volunteering still applies its Reaction (always-call)",
      driver.session.runtimes.B!.negotiation.trustMediator === 52,
      `trustMediator=${driver.session.runtimes.B!.negotiation.trustMediator}`
    );
  }

  // ------------------------------------------------------------------ 2
  console.log("2. volunteering round-trip cap (decisions 2 + 5)");
  {
    const { driver } = makeDriver(
      [
        { utterance: "A opens at 120k.", reaction: {} },                      // addressed
        { utterance: "Then we are far apart.", reaction: { angerDelta: 5 } }, // A volunteers back
      ],
      [
        { utterance: "", reaction: {} },                                      // addressed call declines
        { utterance: "That demand is absurd.", reaction: { angerDelta: 5 } }, // B volunteers
      ]
    );
    driver.openSession();
    await driver.send(["A", "B"], "Please state your positions.");
    ok(
      "one round-trip cap: exactly 4 calls (A, B, B-vol, A-vol-back), then stop",
      driver.invocations.length === 4,
      `invocations=${driver.invocations.length}`
    );
    ok(
      "log order = speaking order (Z, A, B, A)",
      JSON.stringify(driver.session.log.filter((e) => e.kind === "message").map((e) => e.sender)) ===
        JSON.stringify(["Z", "A", "B", "A"]),
      driver.session.log.map((e) => e.sender).join(",")
    );
  }

  // ------------------------------------------------------------------ 3
  console.log("3. mandatory-speak on threshold + transactional failure (decisions 7, 8)");
  {
    const rules: ScenarioRule<Id>[] = [
      { partyId: "A", dimension: "anger", op: ">", threshold: 80, effect: "force_speak" },
    ];
    const { driver } = makeDriver(
      [
        { utterance: "Fine, push me.", reaction: { angerDelta: 70 } }, // anger 20 → 90 crosses 80
        { utterance: "", reaction: {} },                               // forced call: silence
      ],
      [],
      rules
    );
    driver.openSession();
    const before = driver.session.log.length;
    let threw: unknown;
    try {
      // This send lands A's response (anger → 90), fires the rule, and the
      // forced mandatory call in the SAME beat returns silence → loud failure.
      await driver.send(["A"], "A, your position.");
    } catch (e) {
      threw = e;
    }
    ok(
      "mandatory-silent throws TurnError(kind=mandatory_silent)",
      threw instanceof TurnError && threw.kind === "mandatory_silent",
      String(threw)
    );
    ok(
      "transactional: the declined forced call appended nothing",
      driver.session.log.length === before + 2, // Z message + A's valid message only
      `log=${driver.session.log.length}`
    );
  }

  // ------------------------------------------------------------------ 4
  console.log("4. transport retry + audit (decision 8)");
  {
    const { driver, a } = makeDriver([{ utterance: "Recovered.", reaction: {} }], [], [], 1);
    driver.openSession();
    await driver.send(["A"], "Hello A.");
    ok(
      "transport error retried once, response landed",
      a.failuresUsed === 1 && driver.session.log.some((e) => e.sender === "A" && e.kind === "message")
    );
    ok(
      "both attempts audited (1 failed + 1 ok)",
      driver.invocations.filter((i) => i.seatId === "A").length === 2,
      JSON.stringify(driver.invocations.map((i) => [i.seatId, i.attempt, i.ok]))
    );
    // Exhausted retries: loud failure, nothing appended.
    const { driver: d2 } = makeDriver([], [], [], 5);
    d2.openSession();
    const before2 = d2.session.log.length;
    let threw2 = false;
    try {
      await d2.send(["A"], "Hello again.");
    } catch (e) {
      threw2 = e instanceof TurnError && e.kind === "transport";
    }
    ok("exhausted retries throw TurnError(transport)", threw2);
    ok(
      "exhausted retries appended nothing beyond Z's own message",
      d2.session.log.length === before2 + 1
    );
  }

  // ------------------------------------------------------------------ 5
  console.log("5. structural failure is transactional (decision 8)");
  {
    const { driver } = makeDriver([new Error("malformed payload")], []);
    driver.openSession();
    const before = driver.session.log.length;
    const stateBefore = JSON.stringify(driver.session.runtimes.A!.negotiation);
    let threw = false;
    try {
      await driver.send(["A"], "Hello A.");
    } catch (e) {
      threw = e instanceof TurnError && e.kind === "structural";
    }
    ok("structural failure throws TurnError(structural) with no retry", threw);
    ok(
      "agent call appended nothing (Z's message still lands); state unchanged",
      driver.session.log.length === before + 1 &&
        JSON.stringify(driver.session.runtimes.A!.negotiation) === stateBefore
    );
  }

  // ------------------------------------------------------------------ 6
  console.log("6. caucus mechanics (decision 6)");
  {
    const { driver } = makeDriver(
      [
        { utterance: "", reaction: {} },                                      // joint opening: declines
        { utterance: "Off the record: we need this done by June.", reaction: {} }, // caucus response
      ],
      []
    );
    driver.openSession();
    await driver.send(["A", "B"], "Opening statements, please.");
    driver.openCaucus("A");
    ok(
      "caucus_begin bookend is joint-visible (B sees the FACT)",
      projectFor(driver.session, "B").some((e) => (e.payload as any)?.type === "caucus_begin")
    );
    await driver.send(["A"], "What is your real bottom line?");
    const caucusContent = driver.session.log.find(
      (e) => e.sender === "A" && e.kind === "message"
    );
    const bSees = new Set(projectFor(driver.session, "B").map((e) => e.id));
    ok(
      "caucus content visible to A, hidden from B",
      caucusContent !== undefined &&
        projectFor(driver.session, "A").includes(caucusContent) &&
        !bSees.has(caucusContent.id)
    );
    let phaseGuardThrew = false;
    try {
      await driver.send(["B"], "leak attempt");
    } catch (e) {
      phaseGuardThrew = e instanceof TurnError && e.kind === "phase";
    }
    ok("cannot address B during A's caucus", phaseGuardThrew);
    driver.closeCaucus();
    ok(
      "close returns to joint_session; B sees the caucus_end bookend",
      driver.phase === "joint_session" &&
        projectFor(driver.session, "B").some((e) => (e.payload as any)?.type === "caucus_end")
    );
  }

  // ------------------------------------------------------------------ 7
  console.log("7. structured offers (decision 9)");
  {
    const { driver } = makeDriver(
      [
        {
          utterance: "We can do 95k.",
          reaction: { willingnessToSettleDelta: 5 },
          offer: { amount: 95000, terms: "lump sum" },
        },
      ],
      [{ utterance: "", reaction: {} }]
    );
    driver.openSession();
    await driver.send(["A"], "Where can you land?");
    const offerEvent = driver.session.log.find((e) => e.kind === "offer");
    ok(
      "offer event appended with sender A",
      offerEvent !== undefined && offerEvent.sender === "A"
    );
    ok(
      "position updated app-side, never via Reaction",
      driver.session.runtimes.A!.negotiation.position === 95000,
      `position=${driver.session.runtimes.A!.negotiation.position}`
    );
  }

  // ------------------------------------------------------------------ 8
  console.log("8. walkout rule + phase transitions (decisions 10, 11)");
  {
    const rules: ScenarioRule<Id>[] = [
      { partyId: "B", dimension: "willingnessToSettle", op: "<", threshold: 10, effect: "walkout" },
    ];
    const { driver } = makeDriver(
      [{ utterance: "We can work with that.", reaction: {} }],
      [{ utterance: "Then we are done here.", reaction: { willingnessToSettleDelta: -45 } }],
      rules
    );
    driver.openSession();
    await driver.send(["B"], "B, respond to A's 95k.");
    ok("system-forced walkout transitions phase", driver.phase === "walkout", driver.phase);
    ok(
      "walkout event is a joint-visible session_event",
      driver.session.log.some((e) => (e.payload as any)?.type === "walkout")
    );
    ok(
      "beat aborted: A made no calls after the walkout",
      driver.invocations.every((i) => i.seatId !== "A")
    );
    driver.enterReview();
    ok("human-issued review entry after walkout", driver.phase === "review");
  }

  // ------------------------------------------------------------------ 9
  console.log("9. human-issued phase transitions (decision 11)");
  {
    const { driver } = makeDriver([], []);
    driver.openSession();
    driver.declareAgreement();
    ok("human declares agreement from joint_session", driver.phase === "agreement");
    driver.enterReview();
    ok("review entry", driver.phase === "review");
    let threw = false;
    try {
      await driver.send(["A"], "too late");
    } catch (e) {
      threw = e instanceof TurnError && e.kind === "phase";
    }
    ok("no sends after session end (phase guard)", threw);
  }

  // summary
  console.log(
    failed === 0 ? `\nALL PASS (${passed} checks)` : `\n${failed} FAILURE(S), ${passed} passed`
  );
  process.exit(failed === 0 ? 0 : 1);
}

await main();
