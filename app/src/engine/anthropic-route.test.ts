import assert from "node:assert/strict";
import test from "node:test";

import { POST } from "../../app/api/models/anthropic/route";
import { forgetCredentials, registerCredentials } from "../server-credential-vault";

const sessionId = "00000000-0000-4000-8000-000000000020";

function gatewayRequest(overrides: Record<string, unknown> = {}): Request {
  return new Request("http://localhost/api/models/anthropic", {
    method: "POST",
    body: JSON.stringify({
      config: { provider: "anthropic", model: "claude-sonnet-4-5", endpoint: "https://api.anthropic.com/v1/" },
      sessionId,
      partyId: "A",
      prompt: { system: "Return JSON.", user: "Respond to the mediator." },
      ...overrides,
    }),
  });
}

function anthropicResponse(content: string) {
  return Response.json({
    id: "msg_demo",
    content: [{ type: "text", text: content }],
    usage: { input_tokens: 30, output_tokens: 12 },
  });
}

test("Anthropic gateway forwards a Messages request with anthropic auth headers and returns sanitized audit data", async () => {
  registerCredentials(sessionId, { A: "secret-test-key", B: "" });
  const originalFetch = globalThis.fetch;
  let headers = new Headers();
  let requestBody: Record<string, unknown> = {};
  let upstreamUrl = "";
  globalThis.fetch = async (input, init) => {
    upstreamUrl = String(input);
    headers = new Headers(init?.headers);
    requestBody = JSON.parse(String(init?.body));
    return anthropicResponse("```json\n{\"utterance\":\"We can discuss it.\",\"reaction\":{\"trustMediatorDelta\":2}}\n```");
  };
  try {
    const response = await POST(gatewayRequest());
    assert.equal(response.status, 200);
    assert.match(upstreamUrl, /api\.anthropic\.com\/v1\/messages$/);
    assert.equal(headers.get("x-api-key"), "secret-test-key");
    assert.equal(headers.get("anthropic-version"), "2023-06-01");
    assert.equal(requestBody.model, "claude-sonnet-4-5");
    assert.equal(requestBody.system, "Return JSON.");
    assert.deepEqual(requestBody.messages, [{ role: "user", content: "Respond to the mediator." }]);
    assert.equal(typeof requestBody.max_tokens, "number");
    const body = await response.json();
    assert.equal(body.response.utterance, "We can discuss it.");
    assert.deepEqual(body.response.reaction, { trustMediatorDelta: 2 });
    assert.equal(body.audit.requestId, "msg_demo");
    assert.equal(body.audit.tokenUsage.prompt, 30);
    assert.equal(body.audit.tokenUsage.completion, 12);
    assert.equal(body.audit.tokenUsage.total, 42);
    assert.doesNotMatch(JSON.stringify(body.audit.request), /secret-test-key/);
  } finally {
    forgetCredentials(sessionId);
    globalThis.fetch = originalFetch;
  }
});

test("Anthropic gateway joins text blocks and ignores non-text content blocks", async () => {
  registerCredentials(sessionId, { A: "test-key", B: "" });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({
    id: "msg_demo",
    content: [
      { type: "text", text: "{\"utterance\":\"Fine.\"," },
      { type: "thinking", text: "thinking is dropped" },
      { type: "text", text: "\"reaction\":{\"angerDelta\":-1}}" },
    ],
    usage: { input_tokens: 10, output_tokens: 5 },
  });
  try {
    const response = await POST(gatewayRequest());
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.response.utterance, "Fine.");
    assert.deepEqual(body.response.reaction, { angerDelta: -1 });
  } finally {
    forgetCredentials(sessionId);
    globalThis.fetch = originalFetch;
  }
});

test("Anthropic gateway fails before contacting the provider when the memory-only credential expired", async () => {
  let contacted = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { contacted = true; return Response.json({}); };
  try {
    const response = await POST(gatewayRequest({ sessionId: "00000000-0000-4000-8000-000000000021" }));
    assert.equal(response.status, 401);
    assert.equal(contacted, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Anthropic gateway rejects a malformed structured Party response", async () => {
  registerCredentials(sessionId, { A: "test-key", B: "" });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => anthropicResponse(JSON.stringify({ utterance: "No.", reaction: { anger: 80 } }));
  try {
    const response = await POST(gatewayRequest());
    assert.equal(response.status, 422);
  } finally {
    forgetCredentials(sessionId);
    globalThis.fetch = originalFetch;
  }
});

test("Anthropic gateway rejects non-anthropic provider configs", async () => {
  registerCredentials(sessionId, { A: "test-key", B: "" });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("must not be contacted"); };
  try {
    const response = await POST(gatewayRequest({
      config: { provider: "openai", model: "gpt-x", endpoint: "https://api.openai.com/v1/" },
    }));
    assert.equal(response.status, 400);
  } finally {
    forgetCredentials(sessionId);
    globalThis.fetch = originalFetch;
  }
});
