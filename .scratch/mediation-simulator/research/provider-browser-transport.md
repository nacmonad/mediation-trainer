# Research: Browser-direct provider transport (OpenAI / Anthropic / Ollama / OpenAI-compatible)

Ticket: `.scratch/mediation-simulator/issues/04-provider-transport.md`
Date: 2026-08-27
Status: findings verified against official docs and SDK sources (see Sources). Items marked **unverified** could not be confirmed from a primary source and should be tested locally.

## 1. Comparison table

| | OpenAI (`api.openai.com`) | Anthropic (`api.anthropic.com`) | Ollama (`localhost:11434`) | Generic OpenAI-compatible |
|---|---|---|---|---|
| **Browser-direct (CORS)?** | Yes, works from browser. No official doc page states "CORS allowed"; verified via official SDK: browsers supported with `dangerouslyAllowBrowser: true` (SDK README: browsers "disabled by default to avoid exposing your secret API credentials"). | Yes, **with an opt-in header**. The TS SDK sends `anthropic-dangerous-direct-browser-access: true` whenever `dangerouslyAllowBrowser: true` (confirmed in SDK source `buildHeaders`); without it the API rejects browser cross-origin calls. Docs: browsers "disabled by default to avoid exposing your secret API credentials". | Yes for local origins, **with server-side config**. FAQ: "Ollama allows cross-origin requests from `127.0.0.1` and `0.0.0.0` by default. Additional origins can be configured with `OLLAMA_ORIGINS`." A dev app served at e.g. `http://localhost:3000` sends Origin `http://localhost:3000`, which is **not** `127.0.0.1` — expect to need `OLLAMA_ORIGINS=http://localhost:3000` (**unverified nuance**: test locally whether bare `localhost` origins are also accepted by default). | Varies by host. Most LLM gateways (OpenRouter, Together, Groq, etc.) set permissive CORS; but it is not guaranteed per host. Treat as untrusted until probed. |
| **Required config/headers** | Nothing special beyond `Authorization: Bearer <key>`. SDK requires `dangerouslyAllowBrowser` as a client-side guard only. | `anthropic-dangerous-direct-browser-access: true` header (SDK adds it automatically when `dangerouslyAllowBrowser: true`), plus `x-api-key` and `anthropic-version: 2023-06-01` (SDK default). | None (no key); may require user to set `OLLAMA_ORIGINS` env var on `ollama serve` for non-`127.0.0.1` origins. | None beyond key; possibly a proxy shim for hosts with restrictive CORS. |
| **Structured output** | Yes. Chat Completions: `response_format: { type: "json_schema", json_schema: { name, strict: true, schema } }`. Responses API: `text.format: { type: "json_schema", strict, schema }`. Constraints: root must be object, all fields required (use type unions for optional), `additionalProperties: false`, ≤10 nesting levels, ≤5000 properties. gpt-4o-mini 2024-08-06 and later. | Yes, GA. Messages API: `output_config.format` with `type: "json_schema"` (formerly beta `output_format`; beta header `structured-outputs-2025-11-13` still accepted in transition). Also `strict: true` on tools. Limits: 20 strict tools/request, 24 optional params, 16 union-typed params. Claude Opus/Sonnet/Haiku 4.5+. | Yes, two paths: native `/api/chat` takes `format` (either `"json"` or a full JSON schema object) and `tools` for function calling. OpenAI-compat `/v1/chat/completions` supports `response_format` (JSON mode) and `tools` (verified in compatibility matrix); note `tool_choice` is **not** supported there. | Varies. JSON mode is near-universal on OpenAI-compatible gateways; full `json_schema` strict mode is not. Feature-detect at runtime. |
| **Streaming** | Yes, SSE (`stream: true`), on both Chat Completions and Responses APIs; SDK stream helpers. | Yes, SSE via `stream: true` on Messages API; documented event flow (`message_start`, `content_block_start/delta/stop`, `message_delta`, `message_stop`, `ping`). | Yes, `stream: true` (default true) on `/api/chat` and `/api/generate`; also supported on the OpenAI-compat endpoints (NDJSON/SSE per OpenAI wire format). | Usually yes (OpenAI-compat SSE), but confirm per host. |
| **Key handling** | BYOK: `Authorization: Bearer sk-...`. Docs recommend least-privilege scoped keys. Practical: create a **project-scoped key** with usage/spend limits rather than a root user key; rotate/revoke freely. | BYOK: `x-api-key`. Anthropic's "API key best practices" support article warns against exposing keys client-side; mitigations: per-workspace keys, spend limits, key rotation. | No key at all — best-case transport. `Authorization` header ignored (docs use `api_key: 'ollama'` "required but ignored" in the OpenAI-compat examples). | Whatever the host requires; many use OpenAI-style bearer keys. |

## 2. Browser-direct details per provider

### OpenAI

- **CORS**: The API serves permissive CORS so browser-direct `fetch` works. This is *not* stated in any API doc page; the official statement is indirect: the `openai-node` README lists "Web browsers: disabled by default to avoid exposing your secret API credentials. Enable browser support by explicitly setting `dangerouslyAllowBrowser` to `true`" among supported runtimes — i.e., browser use is a supported mode gated only by that client option. The README's "When might this not be dangerous?" section explicitly blesses development/debugging use with short-lived or frequently-rotated credentials, which matches our demo posture.
- The SDK sets no special CORS header; CORS is handled server-side by `api.openai.com`.

### Anthropic

- **CORS**: opt-in. From the SDK source (`src/client.ts`, `buildHeaders`): when `dangerouslyAllowBrowser` is set, the client adds `'anthropic-dangerous-direct-browser-access': 'true'` to every request. Without that header, `api.anthropic.com` rejects browser cross-origin requests. When calling with raw `fetch` (no SDK), **we must set this header ourselves**.
- Auth uses `x-api-key` (not `Authorization: Bearer`) plus `anthropic-version: 2023-06-01`.
- Both the docs page and README state the SDK throws in browser environments unless `dangerouslyAllowBrowser: true` is explicitly passed.

### Ollama

- **CORS**: server-side allowlist. FAQ (quoted verbatim): "Ollama allows cross-origin requests from `127.0.0.1` and `0.0.0.0` by default. Additional origins can be configured with `OLLAMA_ORIGINS`."
- Practical implication for the demo: if the app is served at `http://localhost:3000` (or any port), its Origin header is `http://localhost:3000`, which is not in the default allowlist. Users will likely need `OLLAMA_ORIGINS=http://localhost:3000` (comma-separated for multiple) when starting `ollama serve`. **We should detect the CORS failure and show a copy-pasteable command in the UI.**
- Structured output via native API: `/api/chat` accepts `format` (a JSON schema object) and `tools`; `stream` defaults to `true`.
- OpenAI-compatible endpoints at `http://localhost:11434/v1` (`/v1/chat/completions`, `/v1/responses`, `/v1/models`, `/v1/embeddings`): streaming, JSON mode, and tools supported; `tool_choice` not supported. API key "required but ignored" by OpenAI SDK clients — so our ModelRuntime can send a placeholder.
- Ollama also exposes an **Anthropic-compatible** endpoint (`docs.ollama.com/api/anthropic-compatibility.md`) — potentially useful later but not needed for MVP.

### Generic OpenAI-compatible

- Nothing to verify centrally; CORS behavior is per-host. Recommendation: make the transport layer tolerate blocked CORS and surface a "this host requires a proxy" error, and include an optional proxy-shim escape hatch (below).

## 3. BYOK key handling in-browser (XSS implications)

What the docs say:
- Both official TS SDKs refuse to run in a browser unless `dangerouslyAllowBrowser: true`, with the stated reason: "it risks exposing your secret API credentials to attackers" (identical wording in `openai-node` and `@anthropic-ai/sdk`). Anthropic links this to its [API key best practices](https://support.anthropic.com/en/articles/9767949-api-key-best-practices-keeping-your-keys-safe-and-secure).
- The OpenAI README's "When might this not be dangerous?" section explicitly permits this for internal tools / development with short-lived, frequently-rotated, limited-scope credentials — exactly our demo posture.

XSS exposure (analysis; no single doc page covers this — flagged as reasoning, not citation):
- Keys stored in `localStorage`/`IndexedDB` are readable by **any** script executing in the origin. A single injected script (npm dependency, browser extension, XSS vector) can exfiltrate every stored key. Content-Security-Policy does not retroactively protect data already in storage from a script that bypasses it.
- Sending keys over the wire is unavoidable in a browser-direct BYOK app; the realistic threat model for a **local demo** is malicious code in the bundle, not network interception (TLS covers the latter).

Practical mitigations worth building in MVP (cheap → expensive):
1. **Scoped, disposable keys**: instruct users to create a dedicated key with a hard spend cap (OpenAI: project-scoped keys with budget/usage limits; Anthropic: workspace keys with spend limits), used only for the demo. This converts a leak from "account compromise" to "capped loss". This is the single most effective mitigation and costs the app nothing.
2. **Memory-only option**: offer a "don't remember key" mode — keys held in a JS closure for the session only (never written to storage). Default for Anthropic keys, arguably default for all.
3. **Clear-on-exit**: if persisting, prefer `sessionStorage` (cleared when tab closes) over `localStorage`/`IndexedDB`, and add a "forget all keys" button.
4. **CSP**: strict `script-src` (no `unsafe-inline`, no CDN script tags) to raise the cost of XSS. Doesn't protect stored data from a compromised dependency, but limits passive injection.
5. **Never** transmit keys to any host other than the provider API itself; no telemetry/analytics endpoints.

Not worth building for a demo: key encryption in storage (obfuscation, not protection — the decryption key would live in the same origin), hardware-backed storage (not available cross-browser for this use case).

## 4. Recommendation for the thin `ModelRuntime` adapter layer

**All three named providers work browser-direct; no proxy shim is required for them.** Per-provider differences are small enough to be config, not architecture:

- **Common runtime shape**: one `ModelRuntime` interface — `streamChat(messages, { schema?, signal })` returning an async iterator of normalized deltas. One adapter per provider family: `openai-compat` (covers OpenAI + Ollama `/v1` + most gateways), `anthropic` (Messages API), `ollama-native` (only if we need Ollama's native JSON-schema `format`, which is stricter than OpenAI-compat JSON mode).
- **Per-provider config object**: `{ baseUrl, apiKey?, headers, requestShaper }`. Anthropic adapter always injects `anthropic-dangerous-direct-browser-access: true`; OpenAI-compat adapter passes the user's `baseUrl` straight through.
- **Key storage layer is separate from transport**: a `KeyStore` interface with `session` (memory/sessionStorage) and `persist` (localStorage) implementations, defaulting to session-only. Runtime never reads storage directly.
- **Proxy shim**: keep as an *optional* user-supplied escape hatch (a `proxyUrl` field on the seat config that swaps the fetch target), not a built-in server. Rationale: (a) all first-party providers work browser-direct; (b) a bundled proxy would break the "browser-only, BYOK" property; (c) generic OpenAI-compatible hosts that block CORS are rare and best handled by "enter a proxy URL or pick another host" UI. Revisit only if a target host we care about proves CORS-hostile.
- **Ollama UX note**: because `OLLAMA_ORIGINS` is likely needed, the Ollama adapter should catch the CORS-flavored fetch failure (TypeError on fetch with no response) and render remediation instructions (`OLLAMA_ORIGINS=http://localhost:3000 ollama serve`).

## 5. Sources

- OpenAI SDK README (browser support, `dangerouslyAllowBrowser`): https://raw.githubusercontent.com/openai/openai-node/main/README.md (canonical: https://github.com/openai/openai-node)
- OpenAI structured outputs guide: https://platform.openai.com/docs/guides/structured-outputs
- Anthropic TS SDK docs (browser support, `dangerouslyAllowBrowser`, streaming, default headers): https://platform.claude.com/docs/en/api/sdks/typescript
- Anthropic SDK source setting `anthropic-dangerous-direct-browser-access` when `dangerouslyAllowBrowser` is set: https://raw.githubusercontent.com/anthropics/anthropic-sdk-typescript/main/src/client.ts (`buildHeaders`)
- Anthropic SDK README (browser support + API key best practices link): https://raw.githubusercontent.com/anthropics/anthropic-sdk-typescript/main/README.md
- Anthropic API key best practices (linked from SDK README): https://support.anthropic.com/en/articles/9767949-api-key-best-practices-keeping-your-keys-safe-and-secure
- Anthropic structured outputs (GA, `output_config.format`, schema limits): https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- Anthropic streaming (SSE event flow): https://docs.anthropic.com/en/api/streaming (redirects to https://platform.claude.com/docs/en/build-with-claude/streaming)
- Ollama FAQ (CORS, `OLLAMA_ORIGINS`, env-var config): https://docs.ollama.com/faq
- Ollama chat API (`format` JSON schema, `tools`, `stream` default true): https://docs.ollama.com/api/chat
- Ollama OpenAI compatibility (endpoints, feature matrix, ignored API key): https://docs.ollama.com/api/openai-compatibility

## 6. Open questions / unverified

1. **Ollama default-origin nuance**: the FAQ names `127.0.0.1` and `0.0.0.0` as default-allowed origins, but does not say whether `http://localhost:<port>` origins are also accepted by default (historically they were, but the FAQ no longer says so). Verify locally with a dev server at `localhost:3000`; design assumes `OLLAMA_ORIGINS` may be required and plans the remediation UI accordingly.
2. **OpenAI CORS**: no official doc page states browser CORS is enabled; the conclusion rests on the official SDK supporting browsers as a runtime. Practical risk is low (the API demonstrably serves CORS to browsers), but there is no doc URL to cite for the CORS behavior itself.
3. **Generic OpenAI-compatible hosts**: CORS posture per host unverified by design (out of scope); handled via the optional proxy escape hatch.
4. **Anthropic `dangerouslyAllowBrowser` + header via raw fetch**: verified in SDK source that the header accompanies browser mode; the API's exact behavior when the header is omitted from a browser request (network error vs. 4xx) was not tested here — assume hard failure and treat the header as mandatory in the Anthropic adapter.
