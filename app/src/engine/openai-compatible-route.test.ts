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

test("gateway canonicalizes Venice-style bare Reaction keys into bounded deltas", async () => {
  const sessionId = "00000000-0000-4000-8000-000000000012";
  registerCredentials(sessionId, { A: "test-key", B: "" });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({
    choices: [{ message: { content: JSON.stringify({
      utterance: "We need the invoice resolved.",
      reaction: { anger: 2, willingnessToSettle: 3, rigidity: -1, trustOtherParty: 1 },
    }) } }],
  });
  try {
    const response = await POST(new Request("http://localhost/api/models/openai-compatible", {
      method: "POST",
      body: JSON.stringify({
        config: { provider: "openai", model: "venice-model", endpoint: "https://api.venice.ai/api/v1/" },
        sessionId,
        partyId: "A",
        prompt: { system: "Return JSON.", user: "Respond." },
      }),
    }));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.response.reaction, {
      angerDelta: 2,
      willingnessToSettleDelta: 3,
      rigidityDelta: -1,
      trustOtherPartyDelta: 1,
    });
  } finally {
    forgetCredentials(sessionId);
    globalThis.fetch = originalFetch;
  }
});

test("Venice requests use its native strict structured-output controls", async () => {
  const sessionId = "00000000-0000-4000-8000-000000000014";
  registerCredentials(sessionId, { A: "test-key", B: "" });
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, unknown> = {};
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return Response.json({
      choices: [{ message: { content: JSON.stringify({ utterance: "Ready.", reaction: {} }) } }],
    });
  };
  try {
    const response = await POST(new Request("http://localhost/api/models/openai-compatible", {
      method: "POST",
      body: JSON.stringify({
        config: { provider: "venice", model: "z-ai-glm-5-3-flash", endpoint: "https://api.venice.ai/api/v1" },
        sessionId,
        partyId: "A",
        prompt: { system: "Return JSON.", user: "Respond." },
      }),
    }));
    assert.equal(response.status, 200);
    assert.deepEqual(requestBody.venice_parameters, {
      include_venice_system_prompt: false,
      enable_web_search: "off",
      enable_web_scraping: false,
      enable_web_citations: false,
      enable_x_search: false,
      disable_thinking: true,
      strip_thinking_response: true,
      enable_e2ee: true,
    });
    assert.equal((requestBody.response_format as { type?: string }).type, "json_schema");
    assert.equal(
      (requestBody.response_format as { json_schema?: { name?: string } }).json_schema?.name,
      "party_response",
    );
    assert.equal(
      (requestBody.response_format as { json_schema?: { strict?: boolean } }).json_schema?.strict,
      true,
    );
    assert.deepEqual(
      (requestBody.response_format as { json_schema?: { schema?: { required?: string[] } } }).json_schema?.schema?.required,
      ["utterance", "reaction"],
    );
  } finally {
    forgetCredentials(sessionId);
    globalThis.fetch = originalFetch;
  }
});

test("gateway rejects bare Reaction values that look like absolute state", async () => {
  const sessionId = "00000000-0000-4000-8000-000000000013";
  registerCredentials(sessionId, { A: "test-key", B: "" });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({
    choices: [{ message: { content: JSON.stringify({ utterance: "No.", reaction: { anger: 80 } }) } }],
  });
  try {
    const response = await POST(new Request("http://localhost/api/models/openai-compatible", {
      method: "POST",
      body: JSON.stringify({
        config: { provider: "openai", model: "venice-model", endpoint: "https://api.venice.ai/api/v1/" },
        sessionId,
        partyId: "A",
        prompt: { system: "Return JSON.", user: "Respond." },
      }),
    }));
    assert.equal(response.status, 422);
  } finally {
    forgetCredentials(sessionId);
    globalThis.fetch = originalFetch;
  }
});

test("mediator contract (Party Z) parses the mediator response shape", async () => {
  const sessionId = "00000000-0000-4000-8000-000000000015";
  registerCredentials(sessionId, { A: "", B: "", Z: "z-key" });
  const originalFetch = globalThis.fetch;
  let authorization = "";
  globalThis.fetch = async (_input, init) => {
    authorization = new Headers(init?.headers).get("authorization") ?? "";
    return Response.json({
      choices: [{ message: { content: "```json\n{\"utterance\":\"Let's take a short break.\",\"audience\":\"both\"}\n```" } }],
    });
  };
  try {
    const response = await POST(new Request("http://localhost/api/models/openai-compatible", {
      method: "POST",
      body: JSON.stringify({
        config: { provider: "openai-compatible", model: "model-z", endpoint: "https://models.example/v1/" },
        sessionId,
        partyId: "Z",
        contract: "mediator",
        prompt: { system: "You are the Mediator.", user: "Transcript follows." },
      }),
    }));
    assert.equal(response.status, 200);
    assert.equal(authorization, "Bearer z-key");
    const body = await response.json();
    assert.deepEqual(body.response, { utterance: "Let's take a short break.", audience: "both" });
  } finally {
    forgetCredentials(sessionId);
    globalThis.fetch = originalFetch;
  }
});

test("mediator contract rejects Party-shaped responses and Party ids on Z calls", async () => {
  const sessionId = "00000000-0000-4000-8000-000000000016";
  registerCredentials(sessionId, { A: "", B: "", Z: "z-key" });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({
    choices: [{ message: { content: JSON.stringify({ utterance: "No.", reaction: {} }) } }],
  });
  try {
    const response = await POST(new Request("http://localhost/api/models/openai-compatible", {
      method: "POST",
      body: JSON.stringify({
        config: { provider: "openai-compatible", model: "model-z", endpoint: "https://models.example/v1/" },
        sessionId,
        partyId: "Z",
        contract: "mediator",
        prompt: { system: "You are the Mediator.", user: "Transcript." },
      }),
    }));
    assert.equal(response.status, 422);
  } finally {
    forgetCredentials(sessionId);
    globalThis.fetch = originalFetch;
  }
});

test("Venice mediator calls keep venice_parameters but skip Party structured output", async () => {
  const sessionId = "00000000-0000-4000-8000-000000000017";
  registerCredentials(sessionId, { A: "", B: "", Z: "z-key" });
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, unknown> = {};
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return Response.json({
      choices: [{ message: { content: JSON.stringify({ utterance: "Noted.", audience: "A" }) } }],
    });
  };
  try {
    const response = await POST(new Request("http://localhost/api/models/openai-compatible", {
      method: "POST",
      body: JSON.stringify({
        config: { provider: "venice", model: "z-ai-glm-5-3-flash", endpoint: "https://api.venice.ai/api/v1" },
        sessionId,
        partyId: "Z",
        contract: "mediator",
        prompt: { system: "You are the Mediator.", user: "Transcript." },
      }),
    }));
    assert.equal(response.status, 200);
    assert.ok(requestBody.venice_parameters);
    assert.equal(requestBody.response_format, undefined);
    const body = await response.json();
    assert.deepEqual(body.response, { utterance: "Noted.", audience: "A" });
  } finally {
    forgetCredentials(sessionId);
    globalThis.fetch = originalFetch;
  }
});
