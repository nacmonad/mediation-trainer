import assert from "node:assert/strict";
import test from "node:test";

import { POST } from "../../app/api/models/openai-compatible/route";

test("OpenAI-compatible gateway forwards chat completions and returns sanitized audit data", async () => {
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
        apiKey: "secret-test-key",
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
    globalThis.fetch = originalFetch;
  }
});
