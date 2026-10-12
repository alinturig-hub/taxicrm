"use client";
import { useEffect, useState } from "react";
import { type FreephoneRule } from "@/lib/notifications/freephone-workflow-preview";
type AuditResult = {
  rows: {
    phone: string;
    total: number;
    last12h: number;
    last24h: number;
    missingSource: number;
    readiness: { ready: boolean; blockers: string[]; warnings: string[] };
    missingDate: number;
    payloadDateUsed: number;
  }[];
};
type EvidencePreview = {
  inactivityCounts: {
    count: number;
    known: number;
    missingDate: number;
    missingSource: number;
    payloadDateUsed: number;
  };
  readiness: { ready: boolean; blockers: string[]; warnings: string[] };
};
type Gateway = {
  endpoint: string;
  phoneParameter: string;
  messageParameter: string;
  senderParameter: string;
  sender: string;
  isEnabled: boolean;
  signedParametersSaved?: boolean;
};
type Workflow = {
  id?: string;
  name: string;
  sourceField: string;
  sourceValue: string;
  defaultRecipient: string;
  rules: FreephoneRule[];
  sourceConfirmed: boolean;
  isEnabled: boolean;
  nextRunAt?: string;
};
type Run = {
  id: string;
  startedAt: string;
  status: string;
  result: unknown;
  job: { name: string };
  deliveries: {
    id: string;
    eventType: string;
    destination: string;
    message: string;
    status: string;
    attemptCount: number;
    lastError: string | null;
  }[];
};
const defaultGateway: Gateway = {
  endpoint: "https://orionconnect.co.uk/api/endpoint/webhook",
  phoneParameter: "customer_phone",
  messageParameter: "message",
  senderParameter: "sender",
  sender: "TaxiCRM",
  isEnabled: false,
};
const labels = {
  DAILY_REPORT: "Daily report",
  NO_BOOKINGS: "Freephone inactivity alert",
  BELOW_THRESHOLD: "Below threshold",
};
function blankWorkflow(): Workflow {
  return {
    name: "",
    sourceField: "telephoneNumber",
    sourceValue: "",
    defaultRecipient: "",
    sourceConfirmed: false,
    isEnabled: false,
    rules: [
      {
        event: "DAILY_REPORT",
        enabled: false,
        text: "{freephone}: {count} bookings in {period}.",
        recipient: "",
      },
      {
        event: "NO_BOOKINGS",
        enabled: false,
        windowHours: 12,
        text: "Possible freephone issue: {freephone} has generated no bookings in {period}. Please check the line and booking feed.",
        recipient: "",
      },
      {
        event: "BELOW_THRESHOLD",
        enabled: false,
        text: "{freephone}: {count} bookings; threshold {threshold}.",
        recipient: "",
      },
    ],
  };
}
const input =
  "mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white";
const button =
  "rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50";
const box = "space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5";
export default function NotificationSettings() {
  const [gateway, setGateway] = useState(defaultGateway);
  const [jobs, setJobs] = useState<Workflow[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [preview, setPreview] = useState<EvidencePreview | null>(null);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("TaxiCRM gateway test.");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [testId, setTestId] = useState("");
  const [draftLines, setDraftLines] = useState("");
  const [lookupNumbers, setLookupNumbers] = useState("");
  const [lookupResult, setLookupResult] = useState<AuditResult | null>(null);
  async function request(method = "GET", body?: unknown) {
    const response = await fetch("/api/dashboard/configuration/sms", {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(data.error || "Notification settings unavailable.");
    return data;
  }
  async function reload(includeGateway = false) {
    const data = await request();
    setJobs(data.jobs);
    setRuns(data.runs);
    if (includeGateway) setGateway(data.gateway ?? defaultGateway);
  }
  useEffect(() => {
    void reload(true).catch((e) => setError(e.message));
    const timer = setInterval(() => {
      if (!document.hidden) void reload().catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
    // Initial loading and history polling intentionally preserve unsaved form inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed.");
    } finally {
      setBusy(false);
    }
  }
  function edit(change: Partial<Workflow>) {
    setWorkflow((current) => (current ? { ...current, ...change } : current));
    setPreview(null);
  }
  function ruleEdit(index: number, change: Partial<FreephoneRule>) {
    if (workflow)
      edit({
        rules: workflow.rules.map((r, i) =>
          i === index ? { ...r, ...change } : r,
        ),
      });
  }
  return (
    <div className="space-y-5">
      {error && (
        <p role="alert" className="rounded-lg bg-red-950 p-3 text-red-200">
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-lg bg-emerald-950 p-3 text-emerald-200"
        >
          {notice}
        </p>
      )}
      <section className={box}>
        <h2 className="text-xl font-semibold text-white">Orion SMS gateway</h2>
        <p className="text-sm text-slate-400">
          Saving settings sends no SMS. Signed URL parameters are encrypted and
          never displayed. Orion template: {"{{message}}"}.
        </p>
        {gateway.signedParametersSaved && (
          <p className="text-sm text-emerald-300">
            Signed parameters saved. Keep the same endpoint to retain them.
          </p>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm text-slate-300 md:col-span-2">
            Signed Orion HTTPS URL
            <input
              type="password"
              autoComplete="off"
              className={input}
              value={gateway.endpoint}
              onChange={(e) =>
                setGateway({ ...gateway, endpoint: e.target.value })
              }
            />
          </label>
          {(
            [
              "phoneParameter",
              "messageParameter",
              "senderParameter",
              "sender",
            ] as const
          ).map((key) => (
            <label key={key} className="text-sm text-slate-300">
              {key}
              <input
                className={input}
                value={gateway[key]}
                onChange={(e) =>
                  setGateway({ ...gateway, [key]: e.target.value })
                }
              />
            </label>
          ))}
        </div>
        <label className="block text-sm text-slate-300">
          <input
            type="checkbox"
            checked={gateway.isEnabled}
            onChange={(e) =>
              setGateway({ ...gateway, isEnabled: e.target.checked })
            }
          />{" "}
          Enable SMS delivery
        </label>
        <button
          disabled={busy}
          className={button}
          onClick={() =>
            void action(async () => {
              const data = await request("PUT", gateway);
              setGateway(data.gateway);
              setNotice("Gateway saved. No SMS sent.");
            })
          }
        >
          Save gateway
        </button>
        <details className="border-t border-slate-800 pt-3">
          <summary className="cursor-pointer text-slate-200">
            Test SMS gateway
          </summary>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="text-sm text-slate-300">
              Destination
              <input
                placeholder="+44…"
                className={input}
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setTestId("");
                }}
              />
            </label>
            <label className="text-sm text-slate-300">
              Message
              <input
                className={input}
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  setTestId("");
                }}
              />
            </label>
          </div>
          <p className="my-3 text-sm text-amber-200">
            This queues a real SMS using saved settings. Check its result in the
            history below; provider acceptance does not prove handset delivery.
          </p>
          <button
            disabled={busy}
            className={button}
            onClick={() =>
              void action(async () => {
                const id = testId || crypto.randomUUID();
                setTestId(id);
                await request("POST", {
                  action: "test",
                  destination: phone,
                  message,
                  requestId: id,
                });
                await reload();
                setNotice(
                  "Test queued. The worker checks the queue every minute.",
                );
              })
            }
          >
            Send real test SMS
          </button>
        </details>
      </section>
      <section className={box}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">
            Freephone workflows
          </h2>
          <button
            disabled={busy}
            className={button}
            onClick={() => {
              setWorkflow(blankWorkflow());
              setPreview(null);
            }}
          >
            Add
          </button>
        </div>
        <p className="text-sm text-slate-400">
          Monitor a verified freephone line. The 12-hour option checks
          continuously, across midnight, and sends one inactivity alert until a
          new booking is observed. SMS recipients are entered separately. The
          first check follows a full monitoring window after activation.
        </p>
        <details className="rounded-lg border border-slate-800 p-3">
          <summary className="cursor-pointer text-sm text-slate-200">
            Find bookings by freephone line number
          </summary>
          <textarea
            aria-label="Freephone line numbers"
            className={input}
            rows={2}
            placeholder="One number per line, or separated by commas; up to 25"
            value={lookupNumbers}
            onChange={(e) => {
              setLookupNumbers(e.target.value);
              setLookupResult(null);
            }}
          />
          <button
            disabled={busy}
            className={button}
            onClick={() =>
              void action(async () => {
                setLookupResult(
                  await request("POST", {
                    action: "lookup",
                    phones: lookupNumbers
                      .split(/[\n,;]+/)
                      .map((p) => p.trim())
                      .filter(Boolean),
                  }),
                );
              })
            }
          >
            Find bookings
          </button>
          <p className="mt-2 text-xs text-slate-400">
            Read-only search of TelephoneNumber. UK national, +44 and 0044
            formats match the same line. No SMS is sent.
          </p>
          {lookupResult !== null && (
            <div className="mt-3 overflow-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead>
                  <tr className="border-b border-slate-700 text-xs text-slate-400">
                    <th className="p-2">Monitored line</th>
                    <th className="p-2">Booking history</th>
                    <th className="p-2">Last 12h</th>
                    <th className="p-2">Missing dates</th>
                    <th className="p-2">Evidence status</th>
                    <th className="p-2">Original timestamps used</th>
                  </tr>
                </thead>
                <tbody>
                  {lookupResult.rows.map((row) => (
                    <tr key={row.phone} className="border-b border-slate-800">
                      <td className="p-2 font-mono">{row.phone}</td>
                      <td className="p-2">{row.total}</td>
                      <td className="p-2">{row.last12h}</td>
                      <td
                        className={
                          "p-2 " + (row.missingDate ? "text-amber-300" : "")
                        }
                      >
                        {row.missingDate}
                      </td>
                      <td
                        className="p-2"
                        title={[
                          ...(row.readiness?.blockers ?? []),
                          ...(row.readiness?.warnings ?? []),
                        ].join(" ")}
                      >
                        {row.readiness?.ready ? "Ready" : "Blocked"}
                      </td>
                      <td className="p-2">{row.payloadDateUsed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-slate-400">
                Only verified original booking timestamps are used. Booking
                records and payloads are not changed.
              </p>
            </div>
          )}
        </details>
        <details className="rounded-lg border border-slate-800 p-3">
          <summary className="cursor-pointer text-sm text-slate-200">
            Add monitored lines as disabled drafts
          </summary>
          <label className="mt-3 block text-sm text-slate-300">
            One line per row: name | phone
            <textarea
              className={input}
              rows={3}
              value={draftLines}
              onChange={(e) => setDraftLines(e.target.value)}
              placeholder="Hospital Freephone | 077…"
            />
          </label>
          <p className="my-2 text-xs text-slate-400">
            Up to 25 lines. Existing workflows are preserved. No recipients,
            active events or SMS are created.
          </p>
          <button
            disabled={busy}
            className={button}
            onClick={() =>
              void action(async () => {
                const entries = draftLines
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .map((line) => {
                    const parts = line.split("|");
                    if (parts.length !== 2)
                      throw new Error("Use name | phone for each line.");
                    return { name: parts[0].trim(), phone: parts[1].trim() };
                  });
                const result = await request("POST", {
                  action: "import",
                  entries,
                });
                setDraftLines("");
                await reload();
                setNotice(
                  `${result.created.length} disabled drafts added; ${result.skipped.length} existing lines preserved. Enter the SMS recipient and verify booking evidence before activation.`,
                );
              })
            }
          >
            Save disabled drafts
          </button>
        </details>
        {jobs.map((job) => (
          <div
            key={job.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 p-3 text-sm text-slate-300"
          >
            <span>
              {job.name} · {job.isEnabled ? "Enabled" : "Disabled"} ·{" "}
              {job.defaultRecipient ||
                (job.rules.some((r) => r.recipient)
                  ? "Event recipients"
                  : "Recipient not set")}
              {job.nextRunAt && job.isEnabled && (
                <>
                  {" "}
                  · Next:{" "}
                  {new Date(job.nextRunAt).toLocaleString("en-GB", {
                    timeZone: "Europe/London",
                  })}{" "}
                  London
                </>
              )}
            </span>
            <button
              className={button}
              onClick={() => {
                setWorkflow(job);
                setPreview(null);
              }}
            >
              Edit
            </button>
          </div>
        ))}
        {!jobs.length && (
          <p className="text-sm text-slate-400">
            No workflows. Use Add to configure one.
          </p>
        )}
        {workflow && (
          <div className="space-y-3 border-t border-slate-700 pt-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm text-slate-300">
                Freephone name
                <input
                  className={input}
                  value={workflow.name}
                  onChange={(e) => edit({ name: e.target.value })}
                />
              </label>
              <label className="text-sm text-slate-300">
                General recipient
                <input
                  className={input}
                  placeholder="+44…"
                  value={workflow.defaultRecipient}
                  onChange={(e) => edit({ defaultRecipient: e.target.value })}
                />
              </label>
              <label className="text-sm text-slate-300">
                Autocab source field
                <select
                  className={input}
                  value={workflow.sourceField}
                  onChange={(e) =>
                    edit({
                      sourceField: e.target.value,
                      sourceConfirmed: false,
                    })
                  }
                >
                  <option value="bookingSource">BookingSource</option>
                  <option value="bookedBy">BookedBy</option>
                  <option value="ourReference">OurReference</option>
                  <option value="telephoneNumber">
                    TelephoneNumber — verified freephone line
                  </option>
                </select>
              </label>
              <label className="text-sm text-slate-300">
                {workflow.sourceField === "telephoneNumber"
                  ? "Freephone line number"
                  : "Exact source value"}
                <input
                  className={input}
                  value={workflow.sourceValue}
                  onChange={(e) =>
                    edit({
                      sourceValue: e.target.value,
                      sourceConfirmed: false,
                    })
                  }
                />
              </label>
            </div>
            <p className="text-xs text-slate-400">
              For a verified freephone line, choose TelephoneNumber and enter
              its line number. This is separate from the SMS recipient.
              Otherwise select the field/value that actually identifies this
              freephone in Autocab; keep disabled if no source is verified.
            </p>
            {workflow.rules.map((rule, index) => (
              <details
                key={rule.event}
                className="rounded-lg border border-slate-800 p-3"
              >
                <summary className="cursor-pointer text-sm text-slate-200">
                  {labels[rule.event]} · {rule.enabled ? "On" : "Off"} ·{" "}
                  {rule.recipient || "General recipient"}
                </summary>
                <div className="mt-3 space-y-2">
                  <label className="block text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(e) =>
                        ruleEdit(index, { enabled: e.target.checked })
                      }
                    />{" "}
                    Enable event
                  </label>
                  {rule.event === "NO_BOOKINGS" && (
                    <label className="block text-sm text-slate-300">
                      Hours without bookings
                      <select
                        className={input}
                        value={rule.windowHours ?? 24}
                        onChange={(e) =>
                          ruleEdit(index, {
                            windowHours: Number(e.target.value) as 12 | 24,
                          })
                        }
                      >
                        <option value="12">
                          12 consecutive hours · frequent checks
                        </option>
                        <option value="24">24 hours · daily check</option>
                      </select>
                    </label>
                  )}
                  <textarea
                    className={input}
                    aria-label="Event message"
                    rows={2}
                    value={rule.text}
                    onChange={(e) => ruleEdit(index, { text: e.target.value })}
                  />
                  <input
                    className={input}
                    aria-label="Specific event recipient"
                    placeholder="Specific recipient; blank uses general"
                    value={rule.recipient}
                    onChange={(e) =>
                      ruleEdit(index, { recipient: e.target.value })
                    }
                  />
                  {rule.event === "BELOW_THRESHOLD" && (
                    <label className="block text-sm text-slate-300">
                      Threshold
                      <input
                        className={input}
                        type="number"
                        min="1"
                        value={rule.threshold ?? ""}
                        onChange={(e) =>
                          ruleEdit(index, {
                            threshold: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          })
                        }
                      />
                    </label>
                  )}
                </div>
              </details>
            ))}
            <p className="text-xs text-slate-400">
              Text fields: {"{freephone}, {count}, {period}, {threshold}"}. Each
              triggered event sends its own message. Missing or future matching
              dates block alerts. Unidentified feed records remain visible as
              warnings for known phone lines.
            </p>
            <label className="block text-sm text-slate-300">
              <input
                type="checkbox"
                checked={workflow.sourceConfirmed}
                onChange={(e) => edit({ sourceConfirmed: e.target.checked })}
              />{" "}
              I verified that this field and value identify this freephone
            </label>
            <label className="block text-sm text-slate-300">
              <input
                type="checkbox"
                checked={workflow.isEnabled}
                onChange={(e) => edit({ isEnabled: e.target.checked })}
              />{" "}
              Enable this workflow
            </label>
            <div className="flex gap-2">
              <button
                disabled={busy}
                className={button}
                onClick={() =>
                  void action(async () => {
                    setPreview(
                      await request("POST", { action: "preview", workflow }),
                    );
                  })
                }
              >
                Preview current count
              </button>
              <button
                disabled={busy}
                className={button}
                onClick={() =>
                  void action(async () => {
                    await request("POST", {
                      action: "save",
                      id: workflow.id,
                      workflow,
                    });
                    setWorkflow(null);
                    await reload();
                    setNotice(
                      "Workflow saved. Disabling cancels pending SMS messages for this workflow.",
                    );
                  })
                }
              >
                Save workflow
              </button>
              <button
                className="px-3 text-slate-300"
                onClick={() => setWorkflow(null)}
              >
                Close
              </button>
            </div>
            {preview !== null && (
              <div className="rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm">
                <p
                  className={
                    preview.readiness.ready
                      ? "font-semibold text-emerald-300"
                      : "font-semibold text-amber-300"
                  }
                >
                  {preview.readiness.ready
                    ? "Booking evidence ready"
                    : "Activation blocked by booking evidence"}
                </p>
                <p className="mt-2 text-slate-300">
                  {preview.inactivityCounts.count} bookings in the selected
                  inactivity window · {preview.inactivityCounts.known} in
                  recorded history
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Original payload timestamps used:{" "}
                  {preview.inactivityCounts.payloadDateUsed}
                </p>
                {preview.readiness.blockers.map((reason) => (
                  <p key={reason} className="mt-2 text-amber-200">
                    {reason}
                  </p>
                ))}
                {(preview.readiness.warnings ?? []).map((warning) => (
                  <p key={warning} className="mt-2 text-amber-200">
                    Feed warning: {warning}
                  </p>
                ))}
                <p className="mt-3 text-xs text-slate-400">
                  SMS also requires an enabled gateway, a recipient, a confirmed
                  line and an enabled event. Preview sends no message.
                </p>
              </div>
            )}
          </div>
        )}
      </section>
      <section className={box}>
        <h2 className="text-xl font-semibold text-white">
          Recent checks and SMS history
        </h2>
        <p className="text-sm text-slate-400">
          Latest 30 checks. ACCEPTED = provider accepted; UNCERTAIN = review
          required, no automatic resend.
        </p>
        {runs.map((run) => (
          <details
            key={run.id}
            className="rounded-lg border border-slate-800 p-3"
          >
            <summary className="cursor-pointer text-sm text-slate-200">
              {run.job.name} · {run.status} ·{" "}
              {new Date(run.startedAt).toLocaleString("en-GB", {
                timeZone: "Europe/London",
              })}{" "}
              London
            </summary>
            <pre className="my-2 overflow-auto text-xs text-slate-400">
              {JSON.stringify(run.result, null, 2)}
            </pre>
            {run.deliveries.map((d) => (
              <div
                key={d.id}
                className="my-2 rounded border border-slate-700 p-2 text-sm text-slate-300"
              >
                <p>
                  {d.eventType} → {d.destination} · {d.status} · Attempts{" "}
                  {d.attemptCount}
                </p>
                <p>{d.message}</p>
                {d.lastError && <p className="text-amber-200">{d.lastError}</p>}
              </div>
            ))}
          </details>
        ))}
      </section>
    </div>
  );
}
