/**
 * PROTOTYPE — throwaway smoke driver for engine.ts. Run: `node smoke.ts`
 * Pushes the primitives through the awkward cases and prints state after each.
 * Not a test suite; delete when the ticket resolves.
 */
import {
  createSession,
  appendEvent,
  projectFor,
  caucusAudience,
  jointAudience,
  toggleSeatKind,
  applyPartyReaction,
  discloseInterest,
  canAct,
  type SeatConfig,
  type NegotiationState,
  type Reaction,
} from "./engine.ts";

const A = "A", B = "B", Z = "Z";
const mvpSeats: SeatConfig[] = [
  { id: A, role: "party", kind: "agent", model: { provider: "openai", model: "gpt-4.1" } },
  { id: B, role: "party", kind: "agent", model: { provider: "anthropic", model: "claude-sonnet-4" } },
  { id: Z, role: "mediator", kind: "human" },
];

let s = createSession<"A" | "B" | "Z">(mvpSeats, {
  A: { reservationValue: 225000, position: 450000, hiddenInterests: ["liquidity crisis"] },
  B: { reservationValue: 180000, position: 120000 },
});

function show(label: string) {
  console.log(`\n=== ${label} ===`);
  for (const id of [A, B, Z] as const) {
    const view = projectFor(s, id).map((e) => `${e.seq}:${e.sender}→[${e.audience.join(",")}] ${e.kind}`);
    console.log(`  projection ${id}: ${view.length} events :: ${view.join(" | ")}`);
  }
}

// 1. Joint session — everyone sees everything
s = appendEvent(s, { sender: Z, audience: jointAudience(s), kind: "message", payload: "Welcome. Let's begin." });
s = appendEvent(s, { sender: A, audience: jointAudience(s), kind: "message", payload: "My demand is €450k." });
show("1. joint session");

// 2. Caucus with A — audience scoping
s = { ...s, caucusWith: A };
console.log("\ncaucus audience with A:", caucusAudience(s, A));
s = appendEvent(s, { sender: A, audience: caucusAudience(s, A), kind: "message", payload: "Off the record: we have a liquidity crisis." });
s = { ...s, caucusWith: null };
show("2. after caucus with A (B must see nothing)");

// 3. Illegal: B tries to speak during A's caucus
s = { ...s, caucusWith: A };
try {
  appendEvent(s, { sender: B, audience: [A, B, Z], kind: "message", payload: "let me in" });
  console.log("\n3. FAIL — B was allowed to act during A's caucus");
} catch (e) {
  console.log(`\n3. correctly rejected: ${(e as Error).message}`);
}
s = { ...s, caucusWith: null };

// 4. Illegal: sender not in own audience / unknown audience member
try {
  appendEvent(s, { sender: A, audience: [B, Z], kind: "message", payload: "secret from myself?" });
  console.log("4a. FAIL — sender outside own audience allowed");
} catch (e) {
  console.log(`4a. correctly rejected: ${(e as Error).message}`);
}
try {
  appendEvent(s, { sender: Z, audience: [A, B, Z, "EVALUATOR"] as never, kind: "message", payload: "..." });
  console.log("4b. FAIL — unknown audience member allowed");
} catch (e) {
  console.log(`4b. correctly rejected: ${(e as Error).message}`);
}

// 4b. Illegal: caucus audience must name a party seat
try {
  caucusAudience(s, Z);
  console.log("4c. FAIL — caucus audience accepted a non-party seat");
} catch (e) {
  console.log(`4c. correctly rejected: ${(e as Error).message}`);
}

// 5. Reducer: reaction deltas clamp; substance fields untouched
const before: NegotiationState = s.runtimes[A]!.negotiation;
const hostile: Reaction = { angerDelta: +45, trustMediatorDelta: -30 };
let after = applyPartyReaction(before, hostile);
console.log(`\n5. reducer: anger ${before.anger} → ${after.anger}, trustMediator ${before.trustMediator} → ${after.trustMediator}, reservationValue untouched: ${after.reservationValue === before.reservationValue}`);
const attemptedRewrite = { ...hostile, reservationValueDelta: -100000 } as Reaction;
after = applyPartyReaction(before, attemptedRewrite);
console.log(`5b. model tried to move reservationValue via Reaction → still ${after.reservationValue} (no delta channel exists)`);
s = { ...s, runtimes: { ...s.runtimes, [A]: { ...s.runtimes[A]!, negotiation: after } } };

// 6. Interest disclosure
s = discloseInterest(s, A, "liquidity crisis");
console.log(`\n6. A interests: hidden=${JSON.stringify(s.runtimes[A]!.negotiation.hiddenInterests)} disclosed=${JSON.stringify(s.runtimes[A]!.negotiation.disclosedInterests)}`);

// 7. Seat toggles — war-gaming is config-only
s = toggleSeatKind(s, Z, { provider: "anthropic", model: "claude-sonnet-4" });
s = toggleSeatKind(s, A);
const seatLine = s.seats.map((x) => `${x.id}:${x.kind}${x.kind === "agent" ? `(${x.model.provider})` : ""}`).join("  ");
console.log(`\n7. toggles OK, seats now: ${seatLine}  — engine never switched on kind`);
s = toggleSeatKind(s, A, { provider: "ollama", model: "llama3.1" });
s = toggleSeatKind(s, Z);

// 8. Evaluator seat slots in with zero engine changes
const s2 = createSession<"A" | "B" | "Z" | "E">(
  [...mvpSeats, { id: "E", role: "evaluator", kind: "agent", model: { provider: "openai", model: "gpt-4.1" } }]
);
console.log(`\n8. evaluator seat E added; caucus audience becomes: ${caucusAudience(s2, A).join(",")}`);

console.log("\nsmoke driver complete");
