"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
  type Connection,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  actionNames,
  conditionFields,
  labels,
  makeNode,
  nodeKinds,
  parseDraft,
  ports,
  simulateDraft,
  starterDraft,
  syntheticContext,
  validateDraft,
  variables,
  type FlowDraft,
  type FlowNode,
  type NodeKind,
  type Settings,
  type SimulationContext,
  type SimulationResult,
} from "@/lib/marketing/flows/model";
import styles from "./FlowBuilder.module.css";

type CanvasNode = Node<{ block: FlowNode }, "flow">;
const accents: Record<NodeKind, string> = {
  trigger: "#53b98c",
  message: "#68a5ef",
  question: "#a78bfa",
  condition: "#e6b865",
  tag: "#71b7b0",
  wait: "#ba9fda",
  handoff: "#ed9a78",
  end: "#91a0b6",
  action: "#91a0b6",
};
const symbols: Record<NodeKind, string> = {
  trigger: "▶",
  message: "▤",
  question: "?",
  condition: "◇",
  tag: "#",
  wait: "◷",
  handoff: "↗",
  end: "■",
  action: "↔",
};
function canvasNodes(d: FlowDraft): CanvasNode[] {
  return d.nodes.map((block) => ({
    id: block.id,
    type: "flow",
    position: block.position,
    data: { block },
    deletable: block.kind !== "trigger",
  }));
}
function canvasEdges(d: FlowDraft): Edge[] {
  return d.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.port,
    targetHandle: "in",
    type: "smoothstep",
  }));
}
function Block({ data, selected }: NodeProps<CanvasNode>) {
  const n = data.block;
  const summary =
    n.kind === "condition"
      ? `${n.settings.field} = ${n.settings.value}`
      : n.kind === "wait"
        ? `${n.settings.seconds}s`
        : n.kind === "tag"
          ? n.settings.tag
          : n.kind === "trigger"
            ? n.settings.event
            : n.kind === "action"
              ? "Adapter unavailable"
              : n.settings.text || "Stops this conversation flow";
  return (
    <div
      className={`${styles.block} ${selected ? styles.selected : ""}`}
      style={{ "--block-accent": accents[n.kind] } as CSSProperties}
    >
      {n.kind !== "trigger" && (
        <Handle
          id="in"
          type="target"
          position={Position.Left}
          className={styles.handle}
        />
      )}
      <div className={styles.blockType}>
        <span>{symbols[n.kind]}</span>
        {labels[n.kind]}
      </div>
      <strong>{n.title}</strong>
      <p>{summary}</p>
      {ports(n).map((p) => (
        <div key={p.id} className={styles.port}>
          <span>{p.label}</span>
          <Handle
            id={p.id}
            type="source"
            position={Position.Right}
            className={styles.handle}
          />
        </div>
      ))}
    </div>
  );
}
const nodeTypes = { flow: Block };
const fieldLabel: Record<(typeof conditionFields)[number], string> = {
  last_answer: "Last answer (exact text)",
  marketing_permission: "Marketing permission",
  window_open: "24-hour window open",
  customer_tag: "Customer has tag",
};

export default function FlowBuilder({
  storageScope,
  canEdit = true,
  initialDraft,
  initialSaved = false,
  onSave,
  serverLabel,
  onDirtyChange,
}: {
  storageScope: string;
  canEdit?: boolean;
  initialDraft?: FlowDraft;
  initialSaved?: boolean;
  onSave?: (draft: FlowDraft) => Promise<string>;
  serverLabel?: string;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const initial = useMemo(() => initialDraft || starterDraft(), [initialDraft]);
  const [name, setName] = useState(initial.name),
    [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>(
      canvasNodes(initial),
    ),
    [edges, setEdges, onEdgesChange] = useEdgesState(canvasEdges(initial));
  const [selectedId, setSelectedId] = useState<string | null>("menu"),
    [notice, setNotice] = useState(""),
    [panel, setPanel] = useState<"edit" | "simulate">("edit");
  const [scenario, setScenario] = useState<SimulationContext>(syntheticContext),
    [simulation, setSimulation] = useState<SimulationResult | null>(null),
    [saved, setSaved] = useState(JSON.stringify(initial)),
    [hasSaved, setHasSaved] = useState(initialSaved);
  const [saving, setSaving] = useState(false);
  const graph = useRef<HTMLDivElement>(null),
    file = useRef<HTMLInputElement>(null),
    flow = useRef<ReactFlowInstance<CanvasNode, Edge> | null>(null);
  const storageKey = "taxicrm:whatsapp-flow-draft:v1:" + storageScope;
  const draft: FlowDraft = useMemo(
    () => ({
      format: "taxicrm.flow-draft/v1",
      name,
      nodes: nodes.map((n) => ({ ...n.data.block, position: n.position })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        port: e.sourceHandle || "next",
      })),
    }),
    [name, nodes, edges],
  );
  const fingerprint = JSON.stringify(draft),
    dirty = fingerprint !== saved,
    issues = useMemo(() => validateDraft(draft), [draft]);
  const selected = nodes.find((n) => n.id === selectedId)?.data.block;
  const load = useCallback(
    (d: FlowDraft) => {
      setName(d.name);
      setNodes(canvasNodes(d));
      setEdges(canvasEdges(d));
      setSelectedId(d.nodes[0]?.id || null);
      setSimulation(null);
      setScenario(syntheticContext());
    },
    [setNodes, setEdges],
  );
  useEffect(() => {
    if (onSave) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const d = parseDraft(raw);
        load(d);
        setSaved(JSON.stringify(d));
        setHasSaved(true);
        setNotice("Restored your draft from this browser.");
      }
    } catch {
      setNotice(
        "Saved draft could not be restored. Import a JSON backup or start again.",
      );
    }
  }, [storageKey, load, onSave]);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    setSimulation(null);
    setScenario((old) => ({ ...old, answers: {}, elapsedSeconds: 0 }));
  }, [fingerprint]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function replace(d: FlowDraft) {
    if (
      dirty &&
      !window.confirm(
        "Replace the unsaved draft? Export it first if you need a copy.",
      )
    )
      return;
    load(d);
    setNotice("Draft loaded. Save it to keep this version.");
  }
  function update(settings: Partial<Settings>) {
    if (!canEdit || !selected) return;
    setNodes((old) =>
      old.map((n) =>
        n.id === selected.id
          ? {
              ...n,
              data: {
                block: {
                  ...n.data.block,
                  settings: { ...n.data.block.settings, ...settings },
                },
              },
            }
          : n,
      ),
    );
  }
  function title(value: string) {
    if (!canEdit || !selected) return;
    setNodes((old) =>
      old.map((n) =>
        n.id === selected.id
          ? { ...n, data: { block: { ...n.data.block, title: value } } }
          : n,
      ),
    );
  }
  function add(kind: NodeKind, position?: { x: number; y: number }) {
    if (
      !canEdit ||
      nodes.length >= 64 ||
      kind === "action" ||
      (kind === "trigger" && nodes.some((n) => n.data.block.kind === "trigger"))
    )
      return;
    const bounds = graph.current?.getBoundingClientRect();
    const at = position ||
      (bounds &&
        flow.current?.screenToFlowPosition({
          x: bounds.left + bounds.width / 2,
          y: bounds.top + 150,
        })) || { x: 100, y: 100 };
    const block = makeNode(kind, crypto.randomUUID(), at.x, at.y);
    setNodes((old) => [
      ...old,
      ...canvasNodes({
        format: "taxicrm.flow-draft/v1",
        name,
        nodes: [block],
        edges: [],
      }),
    ]);
    setSelectedId(block.id);
    setPanel("edit");
  }
  function remove() {
    if (!canEdit || !selected || selected.kind === "trigger") return;
    setNodes((old) => old.filter((n) => n.id !== selected.id));
    setEdges((old) =>
      old.filter((e) => e.source !== selected.id && e.target !== selected.id),
    );
    setSelectedId(null);
  }
  function connect(c: Connection) {
    if (!canEdit || !c.source || !c.target || c.source === c.target) return;
    const source = nodes.find((n) => n.id === c.source)?.data.block,
      target = nodes.find((n) => n.id === c.target)?.data.block;
    if (
      !source ||
      target?.kind === "trigger" ||
      !ports(source).some((p) => p.id === c.sourceHandle)
    )
      return;
    setEdges((old) => [
      ...old.filter(
        (e) => !(e.source === c.source && e.sourceHandle === c.sourceHandle),
      ),
      {
        id: crypto.randomUUID(),
        source: c.source!,
        target: c.target!,
        sourceHandle: c.sourceHandle,
        targetHandle: "in",
        type: "smoothstep",
      },
    ]);
  }
  async function save() {
    if (!canEdit || saving) return;
    setSaving(true);
    try {
      parseDraft(fingerprint);
      const result = onSave ? await onSave(draft) : undefined;
      if (!onSave) localStorage.setItem(storageKey, fingerprint);
      setSaved(fingerprint);
      setHasSaved(true);
      setNotice(
        result ||
          "Draft saved in this browser. Export JSON for a portable backup.",
      );
    } catch (e) {
      setNotice("Not saved: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  function download() {
    const blob = new Blob([JSON.stringify(draft, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "whatsapp-flow-draft.json";
    link.click();
    URL.revokeObjectURL(url);
  }
  async function importFile(upload?: File) {
    if (!upload || !canEdit) return;
    try {
      if (upload.size > 65536) throw Error("Draft exceeds 64 KB.");
      replace(parseDraft(await upload.text()));
    } catch (e) {
      setNotice("Import rejected: " + (e as Error).message);
    } finally {
      if (file.current) file.current.value = "";
    }
  }
  function run(next = scenario) {
    setScenario(next);
    setSimulation(simulateDraft(draft, next));
    setPanel("simulate");
  }
  function answer(choice: string) {
    if (!simulation?.nodeId) return;
    run({
      ...scenario,
      answers: { ...scenario.answers, [simulation.nodeId]: choice },
    });
  }
  const s = selected?.settings;
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>MARKETING / WHATSAPP / FLOWS</p>
          <h1>
            Conversation builder{" "}
            <span className={styles.badge}>Draft workspace</span>
          </h1>
          <p className={styles.subtitle}>
            Build the conversation. Test every path before connecting it.
          </p>
        </div>
        <div className={styles.actions}>
          {!onSave && (
            <button
              onClick={() =>
                replace({
                  ...starterDraft(),
                  name: "Untitled flow",
                  nodes: [makeNode("trigger", "start", 80, 180)],
                  edges: [],
                })
              }
              disabled={!canEdit}
            >
              New flow
            </button>
          )}
          <button onClick={() => file.current?.click()} disabled={!canEdit}>
            Import JSON
          </button>
          <button onClick={download}>Export JSON</button>
          <button
            className={styles.save}
            onClick={save}
            disabled={!canEdit || saving || (!dirty && hasSaved)}
          >
            {saving ? "Saving…" : onSave ? "Save new version" : "Save draft"}
          </button>
          <button className={styles.primary} onClick={() => run()}>
            ▷ Simulate
          </button>
        </div>
      </header>
      <div className={styles.info}>
        <span className={styles.dot} /> Simulation only · Messages, tags and
        handoffs stay in this preview.{" "}
        <span>
          {onSave
            ? "Server drafts only. No flow is published or activated."
            : "Example data only. Drafts are saved in this browser."}
        </span>
      </div>
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      {!canEdit && (
        <p className={styles.notice}>
          View access · Editing requires the automation.manage permission.
        </p>
      )}
      <div className={styles.flowTitle}>
        <input
          aria-label="Flow name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          disabled={!canEdit}
        />
        <span>
          {dirty
            ? "Unsaved changes"
            : hasSaved
              ? onSave
                ? "Version saved on server"
                : "Saved in this browser"
              : "Example draft — not saved"}{" "}
          {serverLabel ? ` · ${serverLabel}` : ""} · {nodes.length} blocks ·{" "}
          {edges.length} connections
        </span>
        <button onClick={() => replace(starterDraft())} disabled={!canEdit}>
          Load welcome example
        </button>
      </div>
      <input
        hidden
        ref={file}
        type="file"
        accept="application/json,.json"
        onChange={(e) => void importFile(e.target.files?.[0])}
      />
      <div className={styles.workspace}>
        <aside className={styles.library}>
          <h2>Blocks</h2>
          <p>Click to add or drag onto the canvas.</p>
          {nodeKinds.map((kind) => (
            <button
              key={kind}
              disabled={
                !canEdit ||
                kind === "action" ||
                kind === "trigger" ||
                nodes.length >= 64
              }
              draggable={canEdit && kind !== "action" && kind !== "trigger"}
              onDragStart={(e) =>
                e.dataTransfer.setData("application/taxicrm-flow-kind", kind)
              }
              onClick={() => add(kind)}
              title={
                kind === "action"
                  ? "NeedACab Plus adapters are not connected yet."
                  : kind === "trigger"
                    ? "One trigger per draft."
                    : `Add ${labels[kind]}`
              }
            >
              <span
                className={styles.librarySymbol}
                style={{ color: accents[kind] }}
              >
                {symbols[kind]}
              </span>
              <span>
                {labels[kind]}
                {kind === "action" && <small>Adapter pending</small>}
              </span>
              <span className={styles.plus}>+</span>
            </button>
          ))}
          <div className={styles.libraryNote}>
            Connect an output dot to the input of the next block. Select a
            connection and press Delete to remove it.
          </div>
        </aside>
        <div
          ref={graph}
          className={styles.canvas}
          data-testid="flow-canvas"
          onDragOver={(e) => {
            if (canEdit) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            const kind = e.dataTransfer.getData(
              "application/taxicrm-flow-kind",
            ) as NodeKind;
            if (nodeKinds.includes(kind))
              add(
                kind,
                flow.current?.screenToFlowPosition({
                  x: e.clientX,
                  y: e.clientY,
                }),
              );
          }}
        >
          <div className={styles.canvasHeading}>
            <span>FLOW CANVAS</span>
            <button
              onClick={() =>
                void flow.current?.fitView({ padding: 0.15, duration: 200 })
              }
            >
              Fit all blocks
            </button>
          </div>
          <ReactFlow<CanvasNode, Edge>
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={canEdit ? onNodesChange : undefined}
            onEdgesChange={canEdit ? onEdgesChange : undefined}
            onConnect={connect}
            onInit={(instance) => {
              flow.current = instance;
            }}
            onNodeClick={(_, n) => {
              setSelectedId(n.id);
              setPanel("edit");
            }}
            onNodesDelete={(deleted) =>
              setEdges((old) =>
                old.filter(
                  (e) =>
                    !deleted.some(
                      (n) => n.id === e.source || n.id === e.target,
                    ),
                ),
              )
            }
            nodesDraggable={canEdit}
            nodesConnectable={canEdit}
            edgesReconnectable={false}
            deleteKeyCode={canEdit ? ["Backspace", "Delete"] : null}
            minZoom={0.3}
            maxZoom={1.7}
            defaultViewport={{ x: 35, y: 70, zoom: 0.68 }}
            proOptions={{ hideAttribution: false }}
          >
            <Background gap={22} size={1} />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor={(n) => accents[(n.data.block as FlowNode).kind]}
              pannable
              zoomable
            />
          </ReactFlow>
        </div>
        <aside className={styles.inspector}>
          <div className={styles.panelTabs}>
            <button
              className={panel === "edit" ? styles.activeTab : ""}
              onClick={() => setPanel("edit")}
            >
              Block settings
            </button>
            <button
              className={panel === "simulate" ? styles.activeTab : ""}
              onClick={() => setPanel("simulate")}
            >
              Simulation
            </button>
          </div>
          {panel === "edit" && (
            <div className={styles.panelBody}>
              {selected && s ? (
                <>
                  <p className={styles.eyebrow}>{labels[selected.kind]}</p>
                  <h2>{selected.title || "Untitled block"}</h2>
                  <fieldset disabled={!canEdit}>
                    <label>
                      Block title
                      <input
                        value={selected.title}
                        maxLength={100}
                        onChange={(e) => title(e.target.value)}
                      />
                    </label>
                    {selected.kind === "trigger" && (
                      <label>
                        Starts when
                        <select
                          value={s.event}
                          onChange={(e) => update({ event: e.target.value })}
                        >
                          <option value="message.received">
                            WhatsApp message received
                          </option>
                          <option value="tag.added">
                            Tag added (synthetic event)
                          </option>
                          <optgroup label="NeedACab Plus — adapters pending">
                            <option disabled>Booking confirmed</option>
                            <option disabled>Driver assigned</option>
                            <option disabled>Driver arrived</option>
                            <option disabled>Journey started</option>
                            <option disabled>Journey completed</option>
                            <option disabled>Booking cancelled</option>
                          </optgroup>
                        </select>
                      </label>
                    )}
                    {["message", "question"].includes(selected.kind) && (
                      <>
                        <label>
                          Message text
                          <textarea
                            rows={5}
                            maxLength={
                              selected.kind === "question" ? 1024 : 4096
                            }
                            value={s.text}
                            onChange={(e) => update({ text: e.target.value })}
                          />
                        </label>
                        <div className={styles.variables}>
                          {variables.map((v) => (
                            <button
                              key={v}
                              onClick={() =>
                                update({
                                  text: (s.text || "") + " {{" + v + "}}",
                                })
                              }
                            >
                              {"{{" + v + "}}"}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    {selected.kind === "message" && (
                      <>
                        <label>
                          Message type
                          <select
                            value={s.messageMode}
                            onChange={(e) =>
                              update({
                                messageMode: e.target
                                  .value as Settings["messageMode"],
                              })
                            }
                          >
                            <option value="text">Free text</option>
                            <option value="template">Template preview</option>
                          </select>
                        </label>
                        {s.messageMode === "template" && (
                          <label>
                            Template name
                            <input
                              value={s.templateName}
                              maxLength={100}
                              onChange={(e) =>
                                update({ templateName: e.target.value })
                              }
                            />
                            <small>
                              Approval is simulated here; it is not checked with
                              Meta.
                            </small>
                          </label>
                        )}
                        <label>
                          Purpose
                          <select
                            value={s.purpose}
                            onChange={(e) =>
                              update({
                                purpose: e.target.value as Settings["purpose"],
                              })
                            }
                          >
                            <option value="service">
                              Service / conversation
                            </option>
                            <option value="marketing">Marketing</option>
                          </select>
                        </label>
                      </>
                    )}
                    {selected.kind === "question" && (
                      <div className={styles.answers}>
                        <h3>Answer buttons</h3>
                        {s.choices?.map((c, i) => (
                          <div key={c.id}>
                            <label>
                              Answer button {i + 1}
                              <input
                                value={c.label}
                                maxLength={40}
                                onChange={(e) =>
                                  update({
                                    choices: s.choices!.map((x) =>
                                      x.id === c.id
                                        ? { ...x, label: e.target.value }
                                        : x,
                                    ),
                                  })
                                }
                              />
                            </label>
                            <button
                              aria-label={`Remove answer button ${i + 1}`}
                              disabled={s.choices!.length <= 1}
                              onClick={() => {
                                update({
                                  choices: s.choices!.filter(
                                    (x) => x.id !== c.id,
                                  ),
                                });
                                setEdges((old) =>
                                  old.filter(
                                    (e) =>
                                      !(
                                        e.source === selected.id &&
                                        e.sourceHandle === c.id
                                      ),
                                  ),
                                );
                              }}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <button
                          disabled={(s.choices?.length || 0) >= 3}
                          onClick={() =>
                            update({
                              choices: [
                                ...(s.choices || []),
                                {
                                  id: crypto.randomUUID(),
                                  label: "New answer",
                                },
                              ],
                            })
                          }
                        >
                          + Add answer button
                        </button>
                        <small>
                          The “No reply” output is a separate simulation path.
                        </small>
                      </div>
                    )}
                    {selected.kind === "condition" && (
                      <>
                        <label>
                          Check
                          <select
                            value={s.field}
                            onChange={(e) =>
                              update({
                                field: e.target.value as Settings["field"],
                                value: [
                                  "marketing_permission",
                                  "window_open",
                                ].includes(e.target.value)
                                  ? "true"
                                  : "",
                              })
                            }
                          >
                            {conditionFields.map((f) => (
                              <option key={f} value={f}>
                                {fieldLabel[f]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          {s.field === "customer_tag" ? "Tag" : "Equals"}
                          {["marketing_permission", "window_open"].includes(
                            s.field || "",
                          ) ? (
                            <select
                              value={s.value}
                              onChange={(e) =>
                                update({ value: e.target.value })
                              }
                            >
                              <option value="true">Yes</option>
                              <option value="false">No</option>
                            </select>
                          ) : (
                            <input
                              value={s.value}
                              maxLength={200}
                              onChange={(e) =>
                                update({ value: e.target.value })
                              }
                            />
                          )}
                        </label>
                      </>
                    )}
                    {selected.kind === "tag" && (
                      <label>
                        Tag name
                        <input
                          value={s.tag}
                          maxLength={64}
                          onChange={(e) => update({ tag: e.target.value })}
                        />
                        <small>Only changes the simulated customer tags.</small>
                      </label>
                    )}
                    {selected.kind === "wait" && (
                      <label>
                        Wait duration (seconds)
                        <input
                          type="number"
                          min={1}
                          max={604800}
                          value={s.seconds}
                          onChange={(e) =>
                            update({ seconds: Number(e.target.value) })
                          }
                        />
                        <small>
                          Advance time manually in the simulator. No timer is
                          scheduled.
                        </small>
                      </label>
                    )}
                    {selected.kind === "handoff" && (
                      <p className={styles.help}>
                        The simulation stops and hands the conversation to an
                        operator. No live conversation is changed.
                      </p>
                    )}
                    {selected.kind === "end" && (
                      <p className={styles.help}>
                        Marks this path as complete.
                      </p>
                    )}
                    {selected.kind === "action" && (
                      <>
                        <label>
                          Reserved action
                          <select value={s.action} disabled>
                            {actionNames.map((a) => (
                              <option key={a}>{a}</option>
                            ))}
                          </select>
                        </label>
                        <p className={styles.help}>
                          Unavailable until the NeedACab Plus adapter and
                          authorization checks are implemented.
                        </p>
                      </>
                    )}
                  </fieldset>
                  {selected.kind !== "trigger" && (
                    <button
                      className={styles.danger}
                      disabled={!canEdit}
                      onClick={remove}
                    >
                      Delete block
                    </button>
                  )}
                </>
              ) : (
                <p className={styles.help}>
                  Select a block to edit its settings.
                </p>
              )}
            </div>
          )}
          {panel === "simulate" && (
            <div className={styles.panelBody}>
              <p className={styles.eyebrow}>SYNTHETIC SCENARIO</p>
              <h2>Test the conversation</h2>
              <label>
                Example customer name
                <input
                  value={scenario.customer_name}
                  maxLength={100}
                  onChange={(e) => {
                    setScenario({ ...scenario, customer_name: e.target.value });
                    setSimulation(null);
                  }}
                />
              </label>
              {(
                [
                  ["marketingPermission", "Marketing permission"],
                  ["windowOpen", "24-hour window open"],
                  ["templateApproved", "Template approved (simulated)"],
                  ["operatorTakeover", "Operator has taken over"],
                ] as const
              ).map(([key, label]) => (
                <label className={styles.checkbox} key={key}>
                  <input
                    type="checkbox"
                    checked={scenario[key]}
                    onChange={(e) => {
                      setScenario({ ...scenario, [key]: e.target.checked });
                      setSimulation(null);
                    }}
                  />
                  {label}
                </label>
              ))}
              <button
                className={styles.primary}
                onClick={() =>
                  run({ ...scenario, answers: {}, elapsedSeconds: 0 })
                }
              >
                Run from start
              </button>
              {simulation && (
                <>
                  <div className={styles.resultState} role="status">
                    {simulation.state.replace("_", " ")}
                  </div>
                  <ol className={styles.trace}>
                    {simulation.steps.map((step, i) => (
                      <li key={i}>
                        <strong>{step.title}</strong>
                        <p>{step.detail}</p>
                      </li>
                    ))}
                  </ol>
                  {simulation.state === "QUESTION" && (
                    <div className={styles.simAnswers}>
                      {simulation.choices?.map((c) => (
                        <button key={c.id} onClick={() => answer(c.id)}>
                          {c.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {simulation.state === "WAITING" && (
                    <button
                      onClick={() =>
                        run({
                          ...scenario,
                          elapsedSeconds:
                            scenario.elapsedSeconds +
                            (simulation.remainingSeconds || 0),
                        })
                      }
                    >
                      Advance {simulation.remainingSeconds}s
                    </button>
                  )}
                  {simulation.tags.length > 0 && (
                    <p className={styles.help}>
                      Simulated tags: {simulation.tags.join(", ")}
                    </p>
                  )}
                  <small>
                    No message, booking, tag or handoff was applied outside this
                    preview.
                  </small>
                </>
              )}
            </div>
          )}
        </aside>
      </div>
      <section className={styles.validation}>
        <h2>
          {issues.length
            ? `${issues.length} draft issue${issues.length === 1 ? "" : "s"}`
            : "✓ All paths connected"}
        </h2>
        {issues.length ? (
          <ul>
            {issues.slice(0, 10).map((i, index) => (
              <li key={index}>
                <button
                  onClick={() => {
                    if (i.nodeId) {
                      setSelectedId(i.nodeId);
                      setPanel("edit");
                    }
                  }}
                >
                  {i.nodeId
                    ? `${draft.nodes.find((n) => n.id === i.nodeId)?.title}: `
                    : ""}
                  {i.message}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>
            Ready to simulate. Saving this draft does not publish or activate
            it.
          </p>
        )}
      </section>
    </div>
  );
}
