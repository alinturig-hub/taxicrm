import assert from "node:assert/strict";
import { test } from "node:test";
import { planFreephoneScope } from "./copilot-freephone-planner";

test("uses the approved native Ollama endpoint and rejects changed filters", async () => {
  const endpoint = "http://127.0.0.1:11434";
  const previousUrl = process.env.TAXICRM_COPILOT_OLLAMA_URL;
  const previousOrigins = process.env.TAXICRM_AGENT_OLLAMA_ORIGINS;
  process.env.TAXICRM_COPILOT_OLLAMA_URL = endpoint;
  process.env.TAXICRM_AGENT_OLLAMA_ORIGINS = JSON.stringify([endpoint]);
  const question = "How many bookings from Derriford Freephone did we have this week?";
  const scope = { line: "Derriford", period: "this week" as const };
  try {
    let called = false;
    const plan = await planFreephoneScope(question, scope, async (url, request) => {
      called = true;
      assert.equal(String(url), endpoint + "/api/chat");
      const body = JSON.parse(String(request?.body));
      assert.equal(body.think, false);
      assert.equal(body.messages[1].content, question);
      return Response.json({ message: { content: JSON.stringify(scope) } });
    });
    assert.equal(called, true);
    assert.deepEqual(plan, scope);
    const altered = await planFreephoneScope(question, scope, async () =>
      Response.json({ message: { content: JSON.stringify({ ...scope, period: "last week" }) } }));
    assert.equal(altered, null);
  } finally {
    if (previousUrl === undefined) delete process.env.TAXICRM_COPILOT_OLLAMA_URL;
    else process.env.TAXICRM_COPILOT_OLLAMA_URL = previousUrl;
    if (previousOrigins === undefined) delete process.env.TAXICRM_AGENT_OLLAMA_ORIGINS;
    else process.env.TAXICRM_AGENT_OLLAMA_ORIGINS = previousOrigins;
  }
});
