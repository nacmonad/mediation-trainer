import assert from "node:assert/strict";
import test from "node:test";

import { POST } from "../../app/api/models/openai-compatible/route";
import { forgetCredentials, registerCredentials } from "../server-credential-vault";

test("OpenAI-compatible gateway forwards chat completions and returns sanitized audit data", async () => {
  const sessionId = "00000000-0000-4000-8000-000000000010";
  registerCredentials(sessionId, { A: "secret-test-key", B: "" });
  const originalFetch = globalThis.fetch;
  let authorization = "";
  globalThis.fetch = async (_input, init) => {
    authorization = new Headers(init?.headers).get("authorization") ?? "";
    return Response.json({
      id: "req-demo",
      choices: [{ message: { content: "```json\n{\"utterance\":\"We can discuss it.\",\"reaction\":{\"trustMediatorDelta\":2}}\n```" } }],
      usage: { prompt_tokens: 20, completion_tokens: 8, total_tokens: 28 },
    });
  };
  try {
    const response = await POST(new Request("http://localhost/api/models/openai-compatible", {
      method: "POST",
      body: JSON.stringify({
        config: { provider: "openai-compatible", model: "model-a", endpoint: "https://models.example/v1/" },
        sessionId,
        partyId: "A",
        prompt: { system: "Return JSON.", user: "Respond to the mediator." },
      }),
    }));
    assert.equal(response.status, 200);
    assert.equal(authorization, "Bearer secret-test-key");
    const body = await response.json();
    assert.equal(body.response.utterance, "We can discuss it.");
    assert.equal(body.audit.requestId, "req-demo");
    assert.equal(body.audit.tokenUsage.total, 28);
    assert.doesNotMatch(JSON.stringify(body.audit), /secret-test-key/);
  } finally {
    forgetCredentials(sessionId);
    globalThis.fetch = originalFetch;
  }
});

test("gateway fails before contacting a provider when the memory-only credential expired", async () => {
  let contacted = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { contacted = true; return Response.json({}); };
  try {
    const response = await POST(new Request("http://localhost/api/models/openai-compatible", {
      method: "POST",
      body: JSON.stringify({
        config: { provider: "openai", model: "model-a", endpoint: "https://models.example/v1/" },
        sessionId: "00000000-0000-4000-8000-000000000011",
        partyId: "A",
        prompt: { system: "Return JSON.", user: "Respond." },
      }),
    }));
    assert.equal(response.status, 401);
    assert.equal(contacted, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
