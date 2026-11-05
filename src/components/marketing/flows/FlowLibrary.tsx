"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import FlowBuilder from "./FlowBuilder";
import {
  parseDraft,
  starterDraft,
  type FlowDraft,
} from "@/lib/marketing/flows/model";
import styles from "./FlowBuilder.module.css";
type Summary = {
  id: string;
  name: string;
  version: number;
  archived: boolean;
  updated_at: string;
  updated_by: string;
};
type Revision = {
  version: number;
  archived: boolean;
  author_id: string;
  created_at: string;
};
type OpenFlow = {
  id?: string;
  head: number;
  revision?: number;
  archived: boolean;
  draft: FlowDraft;
};
const endpoint = "/api/dashboard/whatsapp/flows";
async function api(query = "", body?: unknown) {
  const response = await fetch(endpoint + query, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || "Flow storage unavailable.");
  return data;
}
export default function FlowLibrary({
  storageScope,
  canEdit,
}: {
  storageScope: string;
  canEdit: boolean;
}) {
  const [flows, setFlows] = useState<Summary[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState<OpenFlow>({
      head: 0,
      archived: false,
      draft: starterDraft(),
    }),
    [editorKey, setEditorKey] = useState(0);
  const [history, setHistory] = useState<{
    id: string;
    name: string;
    rows: Revision[];
  } | null>(null);
  const dirty = useRef(false);
  const changed = useCallback((value: boolean) => {
    dirty.current = value;
  }, []);
  const refresh = useCallback(async () => {
    const d = await api();
    setFlows(d.flows);
    setLoaded(true);
  }, []);
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, [refresh]);
  const permit = () =>
    !dirty.current ||
    window.confirm(
      "Leave unsaved changes? Export JSON or save first to keep them.",
    );
  function show(value: OpenFlow) {
    dirty.current = false;
    setOpen(value);
    setEditorKey((k) => k + 1);
  }
  async function task(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function load(id: string, version?: number) {
    if (!permit()) return;
    await task(async () => {
      const { flow: f } = await api(
        `?id=${id}${version ? `&version=${version}` : ""}`,
      );
      show({
        id: f.id,
        head: f.head_version,
        revision: version,
        archived: f.head_archived,
        draft: parseDraft(JSON.stringify(f.draft)),
      });
    });
  }
  async function duplicate(id: string, version?: number) {
    if (!permit()) return;
    await task(async () => {
      const { flow: f } = await api(
        `?id=${id}${version ? `&version=${version}` : ""}`,
      );
      const draft = parseDraft(JSON.stringify(f.draft));
      draft.name = draft.name.slice(0, 90) + " copy";
      const { flow: r } = await api("", { action: "create", draft });
      show({ id: r.id, head: r.version, archived: false, draft });
      await refresh();
    });
  }
  async function archive(f: Summary) {
    if (
      !permit() ||
      !window.confirm(
        `${f.archived ? "Restore" : "Archive"} “${f.name}”? No messages will be sent.`,
      )
    )
      return;
    await task(async () => {
      await api("", {
        action: f.archived ? "restore" : "archive",
        id: f.id,
        expectedVersion: f.version,
      });
      if (open.id === f.id)
        show({ head: 0, archived: false, draft: starterDraft() });
      await refresh();
    });
  }
  async function save(draft: FlowDraft) {
    const { flow: f } = await api("", {
      action: open.id ? "save" : "create",
      id: open.id,
      expectedVersion: open.id ? open.head : undefined,
      draft,
    });
    setOpen((old) => ({ ...old, id: f.id, head: f.version }));
    // A failed list refresh must not make a successfully committed save appear failed.
    refresh().catch(() =>
      setError("Version saved; refresh the list to see the latest changes."),
    );
    return `Saved server version ${f.version}. No flow was activated.`;
  }
  const viewing = !!open.revision || open.archived;
  return (
    <div className={styles.root}>
      <section className={styles.library} aria-label="Saved flows">
        <div className={styles.actions}>
          <h2>Saved flows</h2>
          <button disabled={busy} onClick={() => task(refresh)}>
            Refresh list
          </button>
          <button
            disabled={!canEdit || busy}
            onClick={() => {
              if (permit())
                show({ head: 0, archived: false, draft: starterDraft() });
            }}
          >
            Create flow
          </button>
          <button
            disabled={!canEdit || busy}
            onClick={() => {
              if (!permit()) return;
              try {
                const raw = localStorage.getItem(
                  "taxicrm:whatsapp-flow-draft:v1:" + storageScope,
                );
                if (!raw)
                  throw Error(
                    "No draft was saved in this browser for your account.",
                  );
                show({ head: 0, archived: false, draft: parseDraft(raw) });
                setError("");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Open browser draft
          </button>
        </div>
        <p>
          Shared workspace drafts · latest 200 flows · no live execution. Rename
          a flow by editing its name and saving a new version.
        </p>
        {error && <p role="alert">{error}</p>}
        {!loaded && !error && <p>Loading server drafts…</p>}
        {loaded && flows.length === 0 && (
          <p>
            No server drafts yet. Create or import a draft below, then save its
            first version.
          </p>
        )}
        <div className={styles.libraryList}>
          {flows.map((f) => (
            <article key={f.id} className={styles.libraryRow}>
              <div>
                <strong>{f.name}</strong>
                <p>
                  v{f.version} · {f.archived ? "Archived" : "Draft"} ·{" "}
                  {new Date(f.updated_at).toLocaleString("en-GB", {
                    timeZone: "Europe/London",
                  })}{" "}
                  London · Author {f.updated_by}
                </p>
              </div>
              <div className={styles.actions}>
                <button disabled={busy} onClick={() => load(f.id)}>
                  Open
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    task(async () => {
                      const d = await api(`?id=${f.id}&history=true`);
                      setHistory({ id: f.id, name: f.name, rows: d.revisions });
                    })
                  }
                >
                  Versions
                </button>
                <button
                  disabled={!canEdit || busy}
                  onClick={() => duplicate(f.id)}
                >
                  Duplicate
                </button>
                <button disabled={!canEdit || busy} onClick={() => archive(f)}>
                  {f.archived ? "Restore" : "Archive"}
                </button>
              </div>
            </article>
          ))}
        </div>
        {history && (
          <section aria-label="Version history">
            <h3>{history.name} — latest 100 versions</h3>
            <button onClick={() => setHistory(null)}>Close history</button>
            {history.rows.map((r) => (
              <div key={r.version} className={styles.libraryRow}>
                <span>
                  v{r.version} · {r.archived ? "Archived" : "Draft"} ·{" "}
                  {new Date(r.created_at).toLocaleString("en-GB", {
                    timeZone: "Europe/London",
                  })}{" "}
                  London · Author {r.author_id}
                </span>
                <button
                  disabled={busy}
                  onClick={() => load(history.id, r.version)}
                >
                  View and simulate v{r.version}
                </button>
                <button
                  disabled={!canEdit || busy}
                  onClick={() => duplicate(history.id, r.version)}
                >
                  Copy to new flow
                </button>
              </div>
            ))}
          </section>
        )}
      </section>
      {viewing && (
        <p className={styles.notice}>
          Read-only{" "}
          {open.revision ? `version ${open.revision}` : "archived flow"}.
          Simulation uses this exact snapshot. Copy it to a new flow to make
          changes.
        </p>
      )}
      <FlowBuilder
        key={editorKey}
        storageScope={storageScope}
        canEdit={canEdit && !viewing && !busy}
        initialDraft={open.draft}
        initialSaved={!!open.id}
        onSave={save}
        onDirtyChange={changed}
        serverLabel={
          open.id
            ? `${open.revision ? "Viewing" : "Current"} v${open.revision || open.head}`
            : "New server draft"
        }
      />
    </div>
  );
}
