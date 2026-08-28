/**
 * Core participant and runtime primitives, lifted from ticket 01's validated prototype.
 * Pure, DOM-free, dependency-free. The validated version lifts into the Next.js
 * app's engine layer. Nothing here assumes which seats are human or agent.
 */

// ---------------------------------------------------------------------------
// Seats & participants
// ---------------------------------------------------------------------------

/**
 * Seat ids are config-driven, not a literal union: the engine treats them as
 * opaque. The well-known ids ("A" | "B" | "Z") become a *scenario-schema*
 * convention (Zod, ticket 06), not an engine constraint. The generic parameter
 * keeps audience filters type-safe anyway: a `Session<"A" | "B" | "Z">` only
 * accepts those ids in `audience` arrays.
 */
export type SeatId = string;

export type Role = "party" | "mediator" | "evaluator";
export type Kind = "human" | "agent";

export interface ModelConfig {
  provider: "openai" | "anthropic" | "ollama";
  model: string;
  endpoint?: string;
  temperature?: number;
  seed?: number;
}

export interface PersonaConfig {
  displayName: string;
  brief: string;
}

/** Discriminated by `kind`: provider details structurally cannot exist on a human seat. */
export interface HumanSeat {
  id: SeatId;
  role: Role;
  kind: "human";
}

export interface AgentSeat {
  id: SeatId;
  role: Role;
  kind: "agent";
  model: ModelConfig;
}

export type SeatConfig = HumanSeat | AgentSeat;

// ---------------------------------------------------------------------------
// Per-party foundations (PLAN §21's foundational models; the event log is session-level)
// ---------------------------------------------------------------------------

export interface KnowledgeScope {
  /** Facts this party has disclosed into the session (audience decides who saw them). */
  disclosedFacts: string[];
  /** Facts only this party knows; disclosure moves them to `disclosedFacts`. */
  privateFacts: string[];
  /** Case resources visible to this party. */
  documentIds: string[];
}

/** Per-seat scratchpad; never enters another participant's prompt. */
export interface AgentMemory {
  notes: string[];
}

export interface NegotiationState {
  // Mutable-by-reaction dimensions (0–100)
  anger: number;
  trustMediator: number;
  trustOtherParty: number;
  willingnessToSettle: number;
  rigidity: number;
  fatigue: number;

  // Substance. The reducer NEVER touches these via Reaction.
  position: number | null; // openly stated demand (glossary: Position)
  reservationValue: number | null; // private walk-away point
  disclosedInterests: string[];
  hiddenInterests: string[];
  threatenedWalkout: boolean;
}

/**
 * Model-returned perception metadata: deltas on mutable dimensions ONLY.
 * There is no delta channel for reservationValue/position/interests — the
 * model structurally cannot rewrite settlement economics. (OUTLINE: the model
 * renders the character; it doesn't define the character.)
 */
export interface Reaction {
  angerDelta?: number;
  trustMediatorDelta?: number;
  trustOtherPartyDelta?: number;
  willingnessToSettleDelta?: number;
  rigidityDelta?: number;
  fatigueDelta?: number;
}

export interface PartyRuntime {
  seatId: SeatId;
  persona: PersonaConfig;
  negotiation: NegotiationState;
  knowledge: KnowledgeScope;
  memory: AgentMemory;
}

// ---------------------------------------------------------------------------
// Event log
// ---------------------------------------------------------------------------

export type EventKind = "message" | "document" | "offer" | "state_change" | "session_event";

export type Sender<T extends string> = T | "SYSTEM";

export interface MediationEvent<T extends string = string> {
  id: string;
  seq: number;
  timestamp: number;
  sender: Sender<T>;
  /** Participants permitted to observe. The basis of every projection. */
  audience: T[];
  kind: EventKind;
  payload: unknown;
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export interface Session<T extends string = string> {
  seats: readonly SeatConfig[];
  /** Caucus in progress: the party id, or null for joint session. */
  caucusWith: T | null;
  log: readonly MediationEvent<T>[];
  runtimes: Readonly<Partial<Record<T, PartyRuntime>>>;
}

export function clamp(n: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, n));
}

export function initialNegotiationState(
  overrides: Partial<NegotiationState> = {}
): NegotiationState {
  return {
    anger: 20,
    trustMediator: 50,
    trustOtherParty: 30,
    willingnessToSettle: 50,
    rigidity: 60,
    fatigue: 0,
    position: null,
    reservationValue: null,
    disclosedInterests: [],
    hiddenInterests: [],
    threatenedWalkout: false,
    ...overrides,
  };
}

export function createSession<T extends string>(
  seats: readonly SeatConfig[],
  initialStates: Partial<Record<T, Partial<NegotiationState>>> = {},
  personas: Partial<Record<T, PersonaConfig>> = {}
): Session<T> {
  const ids = new Set<string>();
  for (const seat of seats) {
    if (ids.has(seat.id)) throw new Error(`duplicate seat id: ${seat.id}`);
    if (seat.kind === "agent" && !seat.model) {
      throw new Error(`agent seat ${seat.id} requires a ModelConfig`);
    }
    ids.add(seat.id);
  }
  const runtimes: Partial<Record<T, PartyRuntime>> = {};
  for (const seat of seats) {
    if (seat.role !== "party") continue;
    runtimes[seat.id as T] = {
      seatId: seat.id,
      persona: personas[seat.id as T] ?? { displayName: seat.id, brief: "" },
      negotiation: initialNegotiationState(initialStates[seat.id as T]),
      knowledge: { disclosedFacts: [], privateFacts: [], documentIds: [] },
      memory: { notes: [] },
    };
  }
  return { seats, caucusWith: null, log: [], runtimes };
}

export function seatById<T extends string>(session: Session<T>, id: T): SeatConfig | undefined {
  return session.seats.find((s) => s.id === id);
}

export function mediatorId<T extends string>(session: Session<T>): T | undefined {
  return session.seats.find((s) => s.role === "mediator")?.id as T | undefined;
}

export function evaluatorIds<T extends string>(session: Session<T>): T[] {
  return session.seats.filter((s) => s.role === "evaluator").map((s) => s.id as T);
}

/**
 * Audience for a private caucus with `partyId`: the party, the mediator, plus
 * any evaluator seats. OPEN QUESTION: does a future evaluator sit in on caucus
 * events, or only review the transcript afterward?
 */
export function caucusAudience<T extends string>(session: Session<T>, partyId: T): T[] {
  const party = seatById(session, partyId);
  if (!party || party.role !== "party") {
    throw new Error(`caucus audience requires a party seat, got "${partyId}"`);
  }
  const z = mediatorId(session);
  if (!z) throw new Error("no mediator seat configured");
  return [...new Set([partyId, z, ...evaluatorIds(session)])];
}

export function jointAudience<T extends string>(session: Session<T>): T[] {
  return session.seats.map((s) => s.id as T);
}

export function caucusParticipants<T extends string>(session: Session<T>): T[] | null {
  if (!session.caucusWith) return null;
  return caucusAudience(session, session.caucusWith);
}

/** Who may speak right now. Turn *order* is ticket 02's machine; this is the caucus gate only. */
export function canAct<T extends string>(session: Session<T>, seatId: T): boolean {
  const caucus = caucusParticipants(session);
  return caucus === null || caucus.includes(seatId);
}

/**
 * Append an event, returning a NEW session (log is append-only, sessions are
 * immutable copies). Throws on: unknown sender/audience member, empty audience,
 * sender outside its own audience, or acting during someone else's caucus.
 */
export function appendEvent<T extends string>(
  session: Session<T>,
  event: { sender: Sender<T>; audience: T[]; kind: EventKind; payload: unknown }
): Session<T> {
  const ids = new Set(session.seats.map((s) => s.id as string));
  if (event.sender !== "SYSTEM" && !ids.has(event.sender)) {
    throw new Error(`unknown sender: ${event.sender}`);
  }
  if (event.audience.length === 0) throw new Error("event audience must be non-empty");
  for (const a of event.audience) {
    if (!ids.has(a)) throw new Error(`audience member ${a} is not a configured seat`);
  }
  if (event.sender !== "SYSTEM" && !event.audience.includes(event.sender as T)) {
    throw new Error(`sender ${event.sender} must be in its own audience`);
  }
  if (!canAct(session, event.sender as T)) {
    throw new Error(
      `${event.sender} cannot act during the private caucus with ${session.caucusWith}`
    );
  }
  const e: MediationEvent<T> = {
    id: `e${(session.log.length + 1).toString().padStart(4, "0")}`,
    seq: session.log.length + 1,
    timestamp: Date.now(),
    ...event,
  };
  return { ...session, log: [...session.log, e] };
}

/** The Projection: the filtered view of the log a given participant may see. */
export function projectFor<T extends string>(session: Session<T>, viewerId: T): MediationEvent<T>[] {
  return session.log.filter((e) => e.audience.includes(viewerId));
}

/** Swap a seat's kind in place. War-gaming later is just config: A or Z as human/agent. */
export function toggleSeatKind<T extends string>(
  session: Session<T>,
  seatId: T,
  model?: ModelConfig
): Session<T> {
  const seats = session.seats.map((s) => {
    if (s.id !== seatId) return s;
    if (s.kind === "agent") return { id: s.id, role: s.role, kind: "human" } as SeatConfig;
    if (!model) throw new Error(`flipping seat ${seatId} to agent requires a ModelConfig`);
    return { id: s.id, role: s.role, kind: "agent", model } as SeatConfig;
  });
  return { ...session, seats };
}

// ---------------------------------------------------------------------------
// Behavioral state: the deterministic reaction reducer
// ---------------------------------------------------------------------------

const MUTABLE_DIMENSIONS = [
  "anger",
  "trustMediator",
  "trustOtherParty",
  "willingnessToSettle",
  "rigidity",
  "fatigue",
] as const;

type MutableDimension = (typeof MUTABLE_DIMENSIONS)[number];

/**
 * Deterministic translation of Reaction metadata → NegotiationState. Clamps to
 * 0–100. Substance fields have no delta channel here at all; if a scenario
 * ever needs rule-gated changes to them, that's a separate scenario-rules
 * operation, never a Reaction.
 */
export function applyPartyReaction(
  state: NegotiationState,
  reaction: Reaction
): NegotiationState {
  const next: NegotiationState = { ...state };
  for (const dim of MUTABLE_DIMENSIONS) {
    const delta = reaction[`${dim}Delta` as keyof Reaction];
    if (typeof delta === "number") {
      next[dim] = clamp(next[dim] + delta);
    }
  }
  return next;
}

/** The mutable dimensions, exported for prompt-compiler rendering later. */
export const reactionDimensions: readonly MutableDimension[] = MUTABLE_DIMENSIONS;

/** Move an interest from hidden to disclosed (core MVP substance move). */
export function discloseInterest<T extends string>(
  session: Session<T>,
  partyId: T,
  interest: string
): Session<T> {
  const rt = session.runtimes[partyId];
  if (!rt) throw new Error(`no runtime for ${partyId}`);
  if (!rt.negotiation.hiddenInterests.includes(interest)) {
    throw new Error(`${partyId} has no hidden interest "${interest}"`);
  }
  const negotiation: NegotiationState = {
    ...rt.negotiation,
    hiddenInterests: rt.negotiation.hiddenInterests.filter((i) => i !== interest),
    disclosedInterests: [...rt.negotiation.disclosedInterests, interest],
  };
  return {
    ...session,
    runtimes: {
      ...session.runtimes,
      [partyId]: { ...rt, negotiation },
    },
  };
}

// ---------------------------------------------------------------------------
// Model boundary: the thin runtime interface (Vercel AI SDK lives beneath this;
// provider details never leak past it). Audit record per PLAN §10.
// ---------------------------------------------------------------------------

export interface ModelRuntime {
  readonly config: ModelConfig;
  respond(input: {
    projection: readonly MediationEvent[];
    runtime: PartyRuntime;
  }): Promise<{ utterance: string; reaction: Reaction }>;
}

export interface InvocationRecord<T extends string = string> {
  seatId: T;
  model: ModelConfig;
  promptVersion: string;
  visibleEventIds: string[];
  stateBefore: NegotiationState;
  requestHash: string;
  response: string;
  stateAfter: NegotiationState;
}
