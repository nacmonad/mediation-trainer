# 10 — OpenAI-compatible Party runtime

Type: implementation
Status: implemented — awaiting live provider validation
Blocked by: 09 (resolved)

## Question

Replace the scripted demo Parties with real, independently configurable OpenAI-compatible model calls while preserving the existing Session engine's privacy, retry, recovery, and audit boundaries.

Each Party must support its own model, OpenAI-compatible base URL, and memory-only API key. The Party prompt receives the authored persona, private economics and facts, authorized Case resources, and only that Party's audience-filtered Event Projection. Provider output must validate into the existing atomic `AgentResponse` contract. Network calls go through a stateless server route so browser CORS does not dictate provider compatibility; credentials are never persisted, exported, logged, or returned in debug data.

## Answer

Implemented on `ticket/10-openai-compatible-runtime`. The Session now constructs an `OpenAICompatibleRuntime` for each Party rather than a `ScriptedRuntime`. Setup includes OpenAI, Ollama, and custom OpenAI-compatible presets, with independent endpoints/models/keys for Party A and Party B. The server gateway calls `/chat/completions`, accepts compatible JSON or fenced-JSON output, validates Reaction bounds and optional structured Offers, and maps provider/transport failures into the driver's existing retry semantics.

Provider audit data includes sanitized messages, raw provider response, request id, latency, and token usage when reported. It is attached to the existing invocation trace and remains excluded from ordinary Session export. API keys are registered into a short-lived server-RAM vault before Session navigation; later provider calls carry only the opaque Session id and Party id. Keys never enter browser storage, model-call payloads, debug output, or Session exports. Missing/expired credentials fail before contacting the provider.

Automated verification passes. Live validation against at least one configured provider remains before resolution.
