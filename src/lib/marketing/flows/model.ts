/** Browser-only draft model. Never imported by a sender, worker or booking adapter. */
export const nodeKinds = [
  "trigger",
  "message",
  "question",
  "condition",
  "tag",
  "wait",
  "handoff",
  "end",
  "action",
] as const;
export type NodeKind = (typeof nodeKinds)[number];
export const actionNames = [
  "address.search",
  "fare.quote",
  "booking.create",
  "booking.read",
  "booking.update",
  "booking.cancel",
  "booking.tracking_link",
] as const;
export const conditionFields = [
  "last_answer",
  "marketing_permission",
  "window_open",
  "customer_tag",
] as const;
export type Settings = {
  event?: string;
  text?: string;
  messageMode?: "text" | "template";
  templateName?: string;
  purpose?: "service" | "marketing";
  choices?: { id: string; label: string }[];
  field?: (typeof conditionFields)[number];
  value?: string;
  tag?: string;
  seconds?: number;
  action?: (typeof actionNames)[number];
};
export type FlowNode = {
  id: string;
  kind: NodeKind;
  title: string;
  position: { x: number; y: number };
  settings: Settings;
};
export type FlowEdge = {
  id: string;
  source: string;
  target: string;
  port: string;
};
export type FlowDraft = {
  format: "taxicrm.flow-draft/v1";
  name: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
};
export type Issue = { nodeId?: string; message: string };
export const labels: Record<NodeKind, string> = {
  trigger: "Trigger",
  message: "Message",
  question: "Question",
  condition: "Condition",
  tag: "Add tag",
  wait: "Wait",
  handoff: "Operator handoff",
  end: "End",
  action: "Booking action",
};
export const variables = [
  "customer_name",
  "booking_id",
  "pickup_address",
  "dropoff_address",
  "pickup_time",
] as const;
export function makeNode(
  kind: NodeKind,
  id: string,
  x = 100,
  y = 100,
): FlowNode {
  const defaults: Record<NodeKind, Settings> = {
    trigger: { event: "message.received" },
    message: {
      text: "Hello {{customer_name}}. How can we help?",
      messageMode: "text",
      templateName: "",
      purpose: "service",
    },
    question: {
      text: "How can we help?",
      choices: [
        { id: "choice-1", label: "Book a taxi" },
        { id: "choice-2", label: "Offers" },
        { id: "choice-3", label: "Speak to the team" },
      ],
    },
    condition: { field: "marketing_permission", value: "true" },
    tag: { tag: "offers_interest" },
    wait: { seconds: 60 },
    handoff: {},
    end: {},
    action: { action: "booking.read" },
  };
  return {
    id,
    kind,
    title: labels[kind],
    position: { x, y },
    settings: defaults[kind],
  };
}
export function ports(node: FlowNode): { id: string; label: string }[] {
  if (node.kind === "end" || node.kind === "handoff") return [];
  if (node.kind === "question")
    return [
      ...(node.settings.choices || []).map((c) => ({
        id: c.id,
        label: c.label,
      })),
      { id: "timeout", label: "No reply" },
    ];
  if (node.kind === "condition")
    return [
      { id: "yes", label: "Yes" },
      { id: "no", label: "No" },
    ];
  return [{ id: "next", label: "Next" }];
}
export function starterDraft(): FlowDraft {
  const nodes = [
    makeNode("trigger", "start", 0, 140),
    makeNode("question", "menu", 290, 80),
    makeNode("condition", "permission", 610, 20),
    makeNode("message", "offer", 920, 0),
    makeNode("tag", "tag", 1230, 0),
    makeNode("handoff", "team", 610, 360),
    makeNode("end", "done", 1540, 200),
  ];
  nodes[0].title = "New WhatsApp message";
  nodes[1].title = "Welcome menu";
  nodes[2].title = "Marketing permission?";
  nodes[3].title = "Offer preview";
  nodes[3].settings = {
    text: "Hello {{customer_name}}, explore our latest offers with the team.",
    messageMode: "text",
    templateName: "",
    purpose: "marketing",
  };
  nodes[5].title = "Talk to the team";
  const edge = (source: string, target: string, port = "next"): FlowEdge => ({
    id: source + "-" + port,
    source,
    target,
    port,
  });
  return {
    format: "taxicrm.flow-draft/v1",
    name: "Welcome and route",
    nodes,
    edges: [
      edge("start", "menu"),
      edge("menu", "team", "choice-1"),
      edge("menu", "permission", "choice-2"),
      edge("menu", "team", "choice-3"),
      edge("menu", "done", "timeout"),
      edge("permission", "offer", "yes"),
      edge("permission", "done", "no"),
      edge("offer", "tag"),
      edge("tag", "done"),
    ],
  };
}
function record(x: unknown): Record<string, unknown> {
  if (!x || typeof x !== "object" || Array.isArray(x))
    throw Error("Expected an object.");
  return x as Record<string, unknown>;
}
function keys(x: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(x).some((k) => !allowed.includes(k)))
    throw Error("Unsupported draft field.");
}
function text(x: unknown, max = 160, empty = false): string {
  if (typeof x !== "string" || x.length > max || (!empty && !x.trim()))
    throw Error("Invalid or missing text.");
  return x;
}
function id(x: unknown) {
  const v = text(x, 80);
  if (
    !/^[a-zA-Z0-9_-]+$/.test(v) ||
    ["__proto__", "constructor", "prototype"].includes(v)
  )
    throw Error("Invalid block identifier.");
  return v;
}
function member<T extends string>(x: unknown, values: readonly T[]): T {
  if (typeof x !== "string" || !values.includes(x as T))
    throw Error("Unsupported block setting.");
  return x as T;
}
/** Explicit allowlist; imported JSON cannot introduce URLs, code, credentials or live execution modes. */
export function parseDraft(input: string): FlowDraft {
  if (new TextEncoder().encode(input).length > 65536)
    throw Error("Draft exceeds 64 KB.");
  const r = record(JSON.parse(input));
  keys(r, ["format", "name", "nodes", "edges"]);
  if (r.format !== "taxicrm.flow-draft/v1")
    throw Error("Unsupported draft format.");
  if (
    !Array.isArray(r.nodes) ||
    r.nodes.length > 64 ||
    !Array.isArray(r.edges) ||
    r.edges.length > 128
  )
    throw Error("Limit: 64 blocks and 128 connections.");
  const nodes: FlowNode[] = r.nodes.map((value) => {
    const n = record(value);
    keys(n, ["id", "kind", "title", "position", "settings"]);
    const kind = member(n.kind, nodeKinds),
      s = record(n.settings),
      p = record(n.position);
    keys(p, ["x", "y"]);
    if (
      ![p.x, p.y].every(
        (v) =>
          typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 100000,
      )
    )
      throw Error("Invalid block position.");
    const settings: Settings = {};
    const allowed: Record<NodeKind, string[]> = {
      trigger: ["event"],
      message: ["text", "messageMode", "templateName", "purpose"],
      question: ["text", "choices"],
      condition: ["field", "value"],
      tag: ["tag"],
      wait: ["seconds"],
      handoff: [],
      end: [],
      action: ["action"],
    };
    keys(s, allowed[kind]);
    if (kind === "trigger")
      settings.event = member(s.event, ["message.received", "tag.added"]);
    if (kind === "message") {
      settings.text = text(s.text, 4096, true);
      settings.messageMode = member(s.messageMode, [
        "text",
        "template",
      ] as const);
      settings.templateName = text(s.templateName, 100, true);
      settings.purpose = member(s.purpose, ["service", "marketing"] as const);
    }
    if (kind === "question") {
      settings.text = text(s.text, 1024, true);
      if (
        !Array.isArray(s.choices) ||
        s.choices.length < 1 ||
        s.choices.length > 3
      )
        throw Error("Use one to three answer buttons.");
      settings.choices = s.choices.map((v) => {
        const c = record(v);
        keys(c, ["id", "label"]);
        const choiceId = id(c.id);
        if (choiceId === "timeout") throw Error("Reserved button identifier.");
        return { id: choiceId, label: text(c.label, 40) };
      });
      if (
        new Set(settings.choices.map((c) => c.id)).size !==
        settings.choices.length
      )
        throw Error("Duplicate answer button.");
    }
    if (kind === "condition") {
      settings.field = member(s.field, conditionFields);
      settings.value = text(s.value, 200, true);
    }
    if (kind === "tag") settings.tag = text(s.tag, 64, true);
    if (kind === "wait") {
      if (
        typeof s.seconds !== "number" ||
        !Number.isSafeInteger(s.seconds) ||
        s.seconds < 1 ||
        s.seconds > 604800
      )
        throw Error("Wait must be 1 second to 7 days.");
      settings.seconds = s.seconds;
    }
    if (kind === "action") settings.action = member(s.action, actionNames);
    return {
      id: id(n.id),
      kind,
      title: text(n.title, 100),
      position: { x: p.x as number, y: p.y as number },
      settings,
    };
  });
  if (new Set(nodes.map((n) => n.id)).size !== nodes.length)
    throw Error("Duplicate block identifier.");
  const edges: FlowEdge[] = r.edges.map((v) => {
    const e = record(v);
    keys(e, ["id", "source", "target", "port"]);
    return {
      id: id(e.id),
      source: id(e.source),
      target: id(e.target),
      port: id(e.port),
    };
  });
  if (new Set(edges.map((e) => e.id)).size !== edges.length)
    throw Error("Duplicate connection identifier.");
  for (const e of edges)
    if (
      !nodes.some((n) => n.id === e.source) ||
      !nodes.some((n) => n.id === e.target)
    )
      throw Error("Connection references an unknown block.");
  return { format: r.format, name: text(r.name, 100), nodes, edges };
}
export function validateDraft(draft: FlowDraft): Issue[] {
  const issues: Issue[] = [];
  try {
    parseDraft(JSON.stringify(draft));
  } catch (e) {
    return [{ message: (e as Error).message }];
  }
  const triggers = draft.nodes.filter((n) => n.kind === "trigger");
  if (triggers.length !== 1)
    issues.push({ message: "Use exactly one trigger." });
  for (const n of draft.nodes) {
    const outgoing = draft.edges.filter((e) => e.source === n.id),
      incoming = draft.edges.filter((e) => e.target === n.id);
    if (n.kind === "trigger" && incoming.length)
      issues.push({
        nodeId: n.id,
        message: "A trigger cannot have an incoming connection.",
      });
    for (const e of outgoing)
      if (!ports(n).some((p) => p.id === e.port))
        issues.push({
          nodeId: n.id,
          message: "Connection uses an unknown output.",
        });
    for (const p of ports(n)) {
      const count = outgoing.filter((e) => e.port === p.id).length;
      if (count !== 1)
        issues.push({
          nodeId: n.id,
          message: `Connect “${p.label}” to exactly one block.`,
        });
    }
    if (["message", "question"].includes(n.kind) && !n.settings.text?.trim())
      issues.push({ nodeId: n.id, message: "Enter message text." });
    if (
      n.kind === "message" &&
      n.settings.messageMode === "template" &&
      !/^[a-z0-9_]+$/.test(n.settings.templateName || "")
    )
      issues.push({
        nodeId: n.id,
        message:
          "Enter a template name (lowercase letters, digits, underscores).",
      });
    if (n.kind === "tag" && !/^[a-zA-Z0-9_-]+$/.test(n.settings.tag || ""))
      issues.push({
        nodeId: n.id,
        message: "Enter a tag using letters, digits, underscores or hyphens.",
      });
    const stripped = (n.settings.text || "").replace(
      /\{\{\s*([^{}]+?)\s*\}\}/g,
      "",
    );
    if (stripped.includes("{{") || stripped.includes("}}"))
      issues.push({
        nodeId: n.id,
        message: "Malformed variable. Use {{variable_name}}.",
      });
    for (const match of Array.from(
      (n.settings.text || "").matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g),
    ))
      if (!variables.includes(match[1] as (typeof variables)[number]))
        issues.push({ nodeId: n.id, message: `Unknown variable: ${match[1]}` });
  }
  const reached = new Set<string>(),
    visiting = new Set<string>();
  let cycle = false;
  function visit(id: string) {
    if (visiting.has(id)) {
      cycle = true;
      return;
    }
    if (reached.has(id)) return;
    visiting.add(id);
    reached.add(id);
    for (const e of draft.edges.filter((e) => e.source === id)) visit(e.target);
    visiting.delete(id);
  }
  if (triggers[0]) visit(triggers[0].id);
  if (cycle)
    issues.push({
      message: "Cycles are not supported in this draft simulator.",
    });
  for (const n of draft.nodes)
    if (!reached.has(n.id))
      issues.push({
        nodeId: n.id,
        message: "This block is not connected to the trigger.",
      });
  return issues;
}
export type SimulationContext = {
  customer_name: string;
  booking_id: string;
  pickup_address: string;
  dropoff_address: string;
  pickup_time: string;
  marketingPermission: boolean;
  windowOpen: boolean;
  templateApproved: boolean;
  operatorTakeover: boolean;
  tags: string[];
  answers: Record<string, string>;
  elapsedSeconds: number;
};
export const syntheticContext = (): SimulationContext => ({
  customer_name: "Demo customer",
  booking_id: "SYNTHETIC-FLOW-001",
  pickup_address: "Example pickup",
  dropoff_address: "Example destination",
  pickup_time: "Tomorrow, 10:00",
  marketingPermission: false,
  windowOpen: true,
  templateApproved: false,
  operatorTakeover: false,
  tags: [],
  answers: {},
  elapsedSeconds: 0,
});
export type SimulationResult = {
  state: "COMPLETE" | "QUESTION" | "WAITING" | "HANDOFF" | "BLOCKED";
  steps: { nodeId: string; title: string; detail: string }[];
  nodeId?: string;
  choices?: { id: string; label: string }[];
  remainingSeconds?: number;
  tags: string[];
};
export function simulateDraft(
  draft: FlowDraft,
  context: SimulationContext,
): SimulationResult {
  const steps: SimulationResult["steps"] = [],
    tags = [...context.tags];
  const finish = (
    state: SimulationResult["state"],
    extra: Partial<SimulationResult> = {},
  ): SimulationResult => ({ state, steps, tags, ...extra });
  const issues = validateDraft(draft);
  if (issues.length)
    return finish("BLOCKED", {
      steps: issues.map((i) => ({
        nodeId: i.nodeId || "",
        title: "Validation",
        detail: i.message,
      })),
    });
  if (context.operatorTakeover)
    return finish("BLOCKED", {
      steps: [
        {
          nodeId: "",
          title: "Operator takeover",
          detail: "Automatic steps are paused.",
        },
      ],
    });
  let current = draft.nodes.find((n) => n.kind === "trigger"),
    elapsed = context.elapsedSeconds,
    lastAnswer = "";
  for (let i = 0; current && i < 64; i++) {
    const n = current,
      s = n.settings;
    let port = "next",
      detail = "";
    if (n.kind === "trigger") detail = "Synthetic " + s.event;
    if (n.kind === "action") {
      steps.push({
        nodeId: n.id,
        title: n.title,
        detail: "Blocked: NeedACab Plus action adapter is not connected.",
      });
      return finish("BLOCKED");
    }
    if (n.kind === "message" || n.kind === "question") {
      for (const match of Array.from(
        (s.text || "").matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g),
      )) {
        if (!context[match[1] as (typeof variables)[number]]?.trim()) {
          steps.push({
            nodeId: n.id,
            title: n.title,
            detail: "Blocked: missing example value for " + match[1],
          });
          return finish("BLOCKED");
        }
      }
      const render = (s.text || "").replace(
        /\{\{\s*([^{}]+?)\s*\}\}/g,
        (_, key: string) => context[key as (typeof variables)[number]] || "",
      );
      if (
        n.kind === "message" &&
        s.purpose === "marketing" &&
        !context.marketingPermission
      ) {
        steps.push({
          nodeId: n.id,
          title: n.title,
          detail: "Blocked: marketing permission is required.",
        });
        return finish("BLOCKED");
      }
      if (
        (n.kind === "question" || s.messageMode === "text") &&
        !context.windowOpen
      ) {
        steps.push({
          nodeId: n.id,
          title: n.title,
          detail:
            "Blocked: the 24-hour window is closed. Use an approved template.",
        });
        return finish("BLOCKED");
      }
      if (
        n.kind === "message" &&
        s.messageMode === "template" &&
        !context.templateApproved
      ) {
        steps.push({
          nodeId: n.id,
          title: n.title,
          detail:
            "Blocked: approved template evidence is missing in this scenario.",
        });
        return finish("BLOCKED");
      }
      if (n.kind === "question") {
        const answer = context.answers[n.id];
        steps.push({ nodeId: n.id, title: n.title, detail: render });
        if (!answer)
          return finish("QUESTION", {
            nodeId: n.id,
            choices: [
              ...(s.choices || []),
              { id: "timeout", label: "Simulate no reply" },
            ],
          });
        if (!ports(n).some((p) => p.id === answer))
          return finish("BLOCKED", {
            steps: [
              ...steps,
              {
                nodeId: n.id,
                title: "Invalid answer",
                detail: "Answer does not match this question.",
              },
            ],
          });
        port = answer;
        lastAnswer = s.choices?.find((c) => c.id === answer)?.label || "";
        detail = "Answer: " + (lastAnswer || "No reply");
      } else
        detail =
          "SIMULATED " +
          (s.messageMode === "template"
            ? `template ${s.templateName}: `
            : "message: ") +
          render;
    }
    if (n.kind === "condition") {
      const actual =
        s.field === "marketing_permission"
          ? String(context.marketingPermission)
          : s.field === "window_open"
            ? String(context.windowOpen)
            : s.field === "customer_tag"
              ? String(tags.includes(s.value || ""))
              : lastAnswer;
      const expected = s.field === "customer_tag" ? "true" : s.value;
      port = actual === expected ? "yes" : "no";
      detail = `${s.field}: ${port === "yes" ? "Yes" : "No"}`;
    }
    if (n.kind === "tag") {
      if (!tags.includes(s.tag!)) tags.push(s.tag!);
      detail = "Simulated tag: " + s.tag;
    }
    if (n.kind === "wait") {
      const wait = s.seconds!;
      if (elapsed < wait) {
        steps.push({
          nodeId: n.id,
          title: n.title,
          detail: `Waiting ${wait - elapsed}s of simulated time.`,
        });
        return finish("WAITING", {
          nodeId: n.id,
          remainingSeconds: wait - elapsed,
        });
      }
      elapsed -= wait;
      detail = `Advanced ${wait}s in simulation.`;
    }
    if (n.kind === "handoff") {
      steps.push({
        nodeId: n.id,
        title: n.title,
        detail: "Simulated operator handoff. Automation stops here.",
      });
      return finish("HANDOFF");
    }
    if (n.kind === "end") {
      steps.push({ nodeId: n.id, title: n.title, detail: "Flow completed." });
      return finish("COMPLETE");
    }
    steps.push({ nodeId: n.id, title: n.title, detail });
    current = draft.nodes.find(
      (next) =>
        next.id ===
        draft.edges.find((e) => e.source === n.id && e.port === port)?.target,
    );
  }
  return finish("BLOCKED", {
    steps: [
      ...steps,
      { nodeId: "", title: "Stopped", detail: "No valid next block." },
    ],
  });
}
