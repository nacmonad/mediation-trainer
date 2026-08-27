# 04 — Browser-direct provider transport research

Type: research
Status: resolved
Blocked by:

## Question

Verify the facts the provider abstraction (PLAN §3, §2.4) depends on for browser-direct calls, per provider (OpenAI, Anthropic, Ollama / OpenAI-compatible):

- CORS: can the browser call it directly? What headers/config are required (e.g. Anthropic's direct-browser access option, Ollama's `OLLAMA_ORIGINS`)?
- Structured output / JSON-schema support and streaming support per provider.
- Key handling for a BYOK demo: what is exposed, what the XSS exposure actually is (decision accepted at charting), and concrete mitigations worth building in MVP.

Deliverable: a comparison table + recommendation on whether any provider needs a proxy shim in the `ModelRuntime` adapter layer.

## Answer

All three providers work browser-direct — **no proxy shim needed for any of them**. Findings in `.scratch/mediation-simulator/research/provider-browser-transport.md`.

- **OpenAI**: browser-direct works out of the box (official SDK supports browsers via `dangerouslyAllowBrowser: true`; no special CORS header needed). Structured outputs (`response_format`/`text.format` with `json_schema`, `strict: true`) and SSE streaming both supported.
- **Anthropic**: browser-direct works **only with** the `anthropic-dangerous-direct-browser-access: true` header (SDK injects it when `dangerouslyAllowBrowser: true`; verified in SDK source `buildHeaders`). Structured outputs GA via `output_config.format` (`json_schema`) + `strict` tools; SSE streaming supported.
- **Ollama**: browser-direct, but CORS is origin-allowlisted — default origins are `127.0.0.1`/`0.0.0.0` only, so a dev app at `http://localhost:3000` likely needs `OLLAMA_ORIGINS` set on `ollama serve`. Native `/api/chat` takes a JSON schema via `format` and `tools`, `stream` defaults true; OpenAI-compat `/v1` endpoints also support streaming/JSON mode/tools (but not `tool_choice`).
- **Generic OpenAI-compatible hosts**: CORS varies per host — treat as untrusted; the adapter accepts an optional user-supplied `proxyUrl` as an escape hatch, no built-in proxy.

BYOK/XSS: official SDKs explicitly warn browser use exposes secret credentials and gate it behind `dangerouslyAllowBrowser` (OpenAI README notes short-lived/limited-scope creds + dev use as acceptable). Mitigations to build: (1) scoped/disposable keys with hard spend caps as the primary mitigation, (2) memory-only key mode (default), (3) `sessionStorage` + "forget keys" if persisting, (4) strict CSP. Key encryption in storage is not worth building.

ModelRuntime shape: thin per-provider adapters (`openai-compat`, `anthropic`, optional `ollama-native`) behind one `streamChat()` interface with a per-seat config `{ baseUrl, apiKey, headers }`; `KeyStore` (session vs persist) kept separate from transport; Ollama adapter renders `OLLAMA_ORIGINS` remediation on CORS-style fetch failures. Open question flagged: whether bare `localhost:<port>` origins are allowed by Ollama without `OLLAMA_ORIGINS` — verify locally during implementation.
