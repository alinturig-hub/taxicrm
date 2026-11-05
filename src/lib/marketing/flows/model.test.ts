import test from "node:test";
import assert from "node:assert/strict";
import {
  makeNode,
  parseDraft,
  simulateDraft,
  starterDraft,
  syntheticContext,
  validateDraft,
  type FlowDraft,
  type NodeKind,
} from "./model";
function line(...kinds: NodeKind[]): FlowDraft {
  const nodes = [
    makeNode("trigger", "start"),
    ...kinds.map((k, i) => makeNode(k, "n" + i)),
    makeNode("end", "end"),
  ];
  return {
    format: "taxicrm.flow-draft/v1",
    name: "Synthetic test",
    nodes,
    edges: nodes
      .slice(0, -1)
      .map((n, i) => ({
        id: "e" + i,
        source: n.id,
        target: nodes[i + 1].id,
        port: "next",
      })),
  };
}
test("starter graph is valid, asks a correlated question, and follows distinct answer paths", () => {
  const d = starterDraft(),
    c = syntheticContext();
  assert.deepEqual(validateDraft(d), []);
  const first = simulateDraft(d, c);
  assert.equal(first.state, "QUESTION");
  assert.equal(first.nodeId, "menu");
  const handoff = simulateDraft(d, { ...c, answers: { menu: "choice-1" } });
  assert.equal(handoff.state, "HANDOFF");
  assert.ok(!handoff.steps.some((s) => s.detail.includes("SIMULATED message")));
  const noConsent = simulateDraft(d, { ...c, answers: { menu: "choice-2" } });
  assert.equal(noConsent.state, "COMPLETE");
  assert.equal(
    noConsent.steps.some((s) => s.detail.startsWith("SIMULATED message")),
    false,
  );
  const consent = simulateDraft(d, {
    ...c,
    marketingPermission: true,
    answers: { menu: "choice-2" },
  });
  assert.equal(consent.state, "COMPLETE");
  assert.deepEqual(consent.tags, ["offers_interest"]);
  assert.equal(c.tags.length, 0);
  assert.equal(
    simulateDraft(d, { ...c, answers: { menu: "timeout" } }).state,
    "COMPLETE",
  );
  assert.equal(
    simulateDraft(d, { ...c, answers: { menu: "not-a-choice" } }).state,
    "BLOCKED",
  );
});
test("closed-window free text/questions and unapproved templates block; template evidence is synthetic only", () => {
  const d = line("message"),
    c = { ...syntheticContext(), windowOpen: false };
  assert.equal(simulateDraft(d, c).state, "BLOCKED");
  assert.equal(simulateDraft(starterDraft(), c).state, "BLOCKED");
  d.nodes[1].settings.messageMode = "template";
  d.nodes[1].settings.templateName = "synthetic_example";
  assert.equal(simulateDraft(d, c).state, "BLOCKED");
  assert.equal(
    simulateDraft(d, { ...c, templateApproved: true }).state,
    "COMPLETE",
  );
});
test("marketing permission and operator takeover cannot be bypassed by direct graph paths", () => {
  const d = line("tag", "message");
  d.nodes[2].settings.purpose = "marketing";
  const c = syntheticContext();
  assert.equal(simulateDraft(d, c).state, "BLOCKED");
  const result = simulateDraft(d, { ...c, operatorTakeover: true });
  assert.equal(result.state, "BLOCKED");
  assert.deepEqual(result.tags, []);
  assert.deepEqual(c.tags, []);
});
test("wait uses virtual time; booking actions remain blocked without calling any transport", () => {
  const d = line("wait", "message"),
    c = syntheticContext();
  const result = simulateDraft(d, c);
  assert.equal(result.state, "WAITING");
  assert.equal(result.remainingSeconds, 60);
  assert.equal(
    simulateDraft(d, { ...c, elapsedSeconds: 60 }).state,
    "COMPLETE",
  );
  assert.equal(c.elapsedSeconds, 0);
  const blocked = simulateDraft(line("action"), c);
  assert.equal(blocked.state, "BLOCKED");
  assert.match(blocked.steps.at(-1)!.detail, /adapter is not connected/);
});
test("invalid connections, cycles, duplicate ports and orphan nodes prevent simulation", () => {
  const d = line("message");
  d.edges[1].target = "start";
  assert.ok(validateDraft(d).some((i) => i.message.includes("Cycles")));
  assert.equal(simulateDraft(d, syntheticContext()).state, "BLOCKED");
  const duplicate = line("message");
  duplicate.edges.push({ ...duplicate.edges[0], id: "duplicate" });
  assert.ok(
    validateDraft(duplicate).some((i) => i.message.includes("exactly one")),
  );
  const orphan = line("message");
  orphan.nodes.push(makeNode("end", "orphan"));
  assert.ok(validateDraft(orphan).some((i) => i.nodeId === "orphan"));
});
test("required variables never silently become empty strings, and malformed/unknown placeholders are rejected", () => {
  const d = line("message");
  assert.equal(
    simulateDraft(d, { ...syntheticContext(), customer_name: "" }).state,
    "BLOCKED",
  );
  for (const text of [
    "Hello {{password}}",
    "Hello {{}}",
    "Hello {{customer_name",
  ]) {
    d.nodes[1].settings.text = text;
    assert.ok(validateDraft(d).length > 0);
  }
});
test("JSON drafts round-trip; import rejects executable/live fields, unknown nodes and oversized documents", () => {
  const d = starterDraft();
  assert.deepEqual(parseDraft(JSON.stringify(d)), d);
  for (const invalid of [
    { ...d, mode: "LIVE" },
    { ...d, format: "live-workflow" },
    { ...d, nodes: [{ ...d.nodes[0], kind: "http.fetch" }] },
    {
      ...d,
      nodes: [
        {
          ...d.nodes[0],
          settings: { event: "message.received", url: "https://example.test" },
        },
      ],
    },
    {
      ...d,
      edges: [{ id: "bad", source: "missing", target: "start", port: "next" }],
    },
  ])
    assert.throws(() => parseDraft(JSON.stringify(invalid)));
  assert.throws(() => parseDraft(" ".repeat(65537)), /64 KB/);
});
