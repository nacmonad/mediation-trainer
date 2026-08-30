# 11 — Anthropic Party runtime

Type: implementation
Status: resolved
Blocked by: 10 (resolved)

## Question

Complete the PLAN Phase 1 provider set by adding Anthropic as an independent per-Party provider, on the same boundaries ticket 10 established: the Party prompt contract, the memory-only credential vault, the stateless server gateway, the atomic `AgentResponse` contract, and the driver's retry semantics remain unchanged.

## Answer

Implemented on `ticket/11-anthropic-adapter`. Setup now includes an Anthropic preset (default model `claude-sonnet-4-5`, endpoint `https://api.anthropic.com/v1/`); the provider seam is a dedicated `AnthropicRuntime` client posting to a new `/api/models/anthropic` gateway route. The route calls the Anthropic Messages API with `x-api-key` and `anthropic-version` headers, supplies the required `max_tokens` budget, maps the system prompt to the Messages `system` field, and joins text content blocks while ignoring non-text blocks. Token usage maps `input_tokens`/`output_tokens` onto the existing audit shape.

The shared structured-Party-response contract (bounded Reaction schema with bare-key aliasing, optional Offer, fenced/bare JSON extraction) was extracted from the OpenAI-compatible route into `src/engine/party-response.ts` so both gateways validate against one contract. Anthropic does not support native strict JSON Schema output on Messages, so structure is enforced by prompt contract plus the shared parser, matching the non-Venice path of the OpenAI-compatible gateway.

Resolved 2026-08-30. Verification passes: 23 engine tests (5 new for the Anthropic gateway), ESLint, and the Next.js production build. Live validation against the real Anthropic API has not been performed yet — first session with an Anthropic Party seat should confirm the preset.
