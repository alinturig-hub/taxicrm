"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

type Execution = {
  id: string;
  mode: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  selected: number;
  processed: number;
  succeeded: number;
  failed: number;
  hasMore: boolean | null;
  evidence: unknown;
  error: string | null;
};

type JobRun = {
  id: string;
  status: string;
  source: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  selected: number;
  processed: number;
  succeeded: number;
  failed: number;
  hasMore: boolean | null;
};

type AutomationRule = {
  id: string;
  key: string;
  name: string;
  description: string;
  jobKey: string;
  status: string;
  mode: string;
  requiresApproval: boolean;
  expectedIntervalMin: number;
  defaultBatchSize: number;
  configuration: unknown;
  lastSimulatedAt: string | null;
  lastExecutedAt: string | null;
  simulations: Execution[];
  latestJobRun: JobRun | null;
};

type AutomationData = {
  success: true;
  generatedAt: string;
  access: {
    canView: boolean;
    canManage: boolean;
  };
  safeguards: {
    defaultMode: string;
    existingCronsPreserved: boolean;
    directExecutionEnabled: boolean;
    customerContactEnabled: boolean;
  };
  rules: AutomationRule[];
};

function formatDateTime(
  value: string | null,
) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/London",
    },
  ).format(new Date(value));
}

function formatInterval(
  minutes: number,
) {
  if (minutes < 60) {
    return `Every ${minutes} min`;
  }

  if (minutes < 1440) {
    return `Every ${Math.round(
      minutes / 60,
    )} hours`;
  }

  return "Daily";
}

function evidenceObject(
  value: unknown,
): Record<string, unknown> {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? value as Record<
        string,
        unknown
      >
    : {};
}

function numberEvidence(
  evidence: Record<
    string,
    unknown
  >,
  key: string,
) {
  const value = evidence[key];

  return typeof value === "number"
    ? value
    : null;
}

function simulationDetails(
  rule: AutomationRule,
  execution: Execution,
) {
  const evidence =
    evidenceObject(
      execution.evidence,
    );

  if (
    rule.key ===
    "BOOKING_PREDICTION_MAINTENANCE"
  ) {
    return [
      {
        label:
          "Profiles waiting",
        value:
          numberEvidence(
            evidence,
            "candidateProfiles",
          ),
      },
      {
        label:
          "Would refresh",
        value:
          numberEvidence(
            evidence,
            "wouldRefresh",
          ),
      },
      {
        label:
          "Would evaluate",
        value:
          numberEvidence(
            evidence,
            "wouldEvaluate",
          ),
      },
    ];
  }

  if (
    rule.key ===
    "CUSTOMER_PROFILE_SNAPSHOTS"
  ) {
    return [
      {
        label:
          "Eligible profiles",
        value:
          numberEvidence(
            evidence,
            "eligibleProfiles",
          ),
      },
      {
        label:
          "Would snapshot",
        value:
          numberEvidence(
            evidence,
            "wouldSnapshot",
          ),
      },
    ];
  }

  if (
    rule.key ===
    "BOOKING_DEMAND_FORECAST"
  ) {
    return [
      {
        label:
          "Expired forecasts",
        value:
          numberEvidence(
            evidence,
            "expiredForecasts",
          ),
      },
      {
        label:
          "Active forecasts",
        value:
          numberEvidence(
            evidence,
            "activeForecasts",
          ),
      },
      {
        label:
          "Open alerts",
        value:
          numberEvidence(
            evidence,
            "currentOpenAlerts",
          ),
      },
    ];
  }

  return [
    {
      label:
        "Waiting locations",
      value:
        numberEvidence(
          evidence,
          "waitingLocations",
        ),
    },
    {
      label:
        "Would enrich",
      value:
        numberEvidence(
          evidence,
          "wouldEnrich",
        ),
    },
    {
      label:
        "Credits consumed",
      value:
        numberEvidence(
          evidence,
          "providerCreditsConsumed",
        ),
    },
  ];
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone:
    | "green"
    | "amber"
    | "blue"
    | "slate";
}) {
  const classes = {
    green:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    amber:
      "border-amber-500/30 bg-amber-500/10 text-amber-300",
    blue:
      "border-blue-500/30 bg-blue-500/10 text-blue-300",
    slate:
      "border-slate-600 bg-slate-800/70 text-slate-300",
  };

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${classes[tone]}`}
    >
      {children}
    </span>
  );
}

export default function AIAutomationWorkspace() {
  const [data, setData] =
    useState<AutomationData | null>(
      null,
    );
  const [loading, setLoading] =
    useState(true);
  const [
    simulatingRuleId,
    setSimulatingRuleId,
  ] = useState<string | null>(null);
  const [error, setError] =
    useState<string | null>(null);

  const load = useCallback(
    async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          "/api/dashboard/ai/automation",
          {
            cache: "no-store",
          },
        );

        const payload =
          await response.json();

        if (
          !response.ok ||
          !payload.success
        ) {
          throw new Error(
            payload.message ??
              "Automation could not be loaded.",
          );
        }

        setData(
          payload as AutomationData,
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Automation could not be loaded.",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function simulate(
    ruleId: string,
  ) {
    try {
      setSimulatingRuleId(ruleId);
      setError(null);

      const response = await fetch(
        `/api/dashboard/ai/automation/${ruleId}/simulate`,
        {
          method: "POST",
          headers: {
            "content-type":
              "application/json",
          },
        },
      );

      const payload =
        await response.json();

      if (
        !response.ok ||
        !payload.success
      ) {
        throw new Error(
          payload.message ??
            "Simulation failed.",
        );
      }

      await load();
    } catch (simulationError) {
      setError(
        simulationError instanceof Error
          ? simulationError.message
          : "Simulation failed.",
      );
    } finally {
      setSimulatingRuleId(null);
    }
  }

  if (loading && !data) {
    return (
      <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-8 text-sm text-slate-400">
        Loading controlled automation…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">
        {error ??
          "Automation is unavailable."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-blue-500/20 bg-slate-900/70 p-6 shadow-xl shadow-black/10">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-400">
              AI Center
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">
              Automation
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              Preview controlled operational work
              before approval. Simulations use real
              aggregate counts but perform no job,
              provider call or customer contact.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge tone="blue">
              SIMULATION ONLY
            </Badge>
            <Badge tone="green">
              EXISTING CRONS PRESERVED
            </Badge>
          </div>
        </div>
      </section>

      {error ? (
        <section className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
            Rules
          </p>
          <p className="mt-2 text-2xl font-bold text-white">
            {data.rules.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Controlled operational rules
          </p>
        </article>
        <article className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
            Enabled rules
          </p>
          <p className="mt-2 text-2xl font-bold text-white">
            {
              data.rules.filter(
                (rule) =>
                  rule.status !==
                  "DISABLED",
              ).length
            }
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Expected to remain zero
          </p>
        </article>
        <article className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
            Direct execution
          </p>
          <p className="mt-2 text-2xl font-bold text-white">
            {data.safeguards
              .directExecutionEnabled
              ? "ON"
              : "OFF"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            No production action from UI
          </p>
        </article>
        <article className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
            Customer contact
          </p>
          <p className="mt-2 text-2xl font-bold text-white">
            {data.safeguards
              .customerContactEnabled
              ? "ON"
              : "OFF"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            No messages or calls
          </p>
        </article>
      </section>

      <section className="space-y-4">
        {data.rules.map((rule) => {
          const latestSimulation =
            rule.simulations[0] ??
            null;
          const details =
            latestSimulation
              ? simulationDetails(
                  rule,
                  latestSimulation,
                )
              : [];

          return (
            <article
              key={rule.id}
              className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-6"
            >
              <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="slate">
                      {rule.status}
                    </Badge>
                    <Badge tone="blue">
                      {rule.mode}
                    </Badge>
                    {rule.requiresApproval ? (
                      <Badge tone="amber">
                        APPROVAL REQUIRED
                      </Badge>
                    ) : null}
                  </div>

                  <h2 className="mt-4 text-xl font-bold text-white">
                    {rule.name}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {rule.description}
                  </p>
                  <p className="mt-3 text-xs text-slate-500">
                    Existing schedule:{" "}
                    {formatInterval(
                      rule.expectedIntervalMin,
                    )}{" "}
                    · simulation batch{" "}
                    {rule.defaultBatchSize}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={
                    !data.access
                      .canManage ||
                    simulatingRuleId !==
                      null
                  }
                  onClick={() =>
                    void simulate(rule.id)
                  }
                  className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-5 py-3 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {simulatingRuleId ===
                  rule.id
                    ? "Simulating…"
                    : "Run simulation"}
                </button>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-700 bg-slate-950/35 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Existing cron health
                  </p>
                  {rule.latestJobRun ? (
                    <>
                      <div className="mt-3 flex items-center gap-2">
                        <Badge
                          tone={
                            rule.latestJobRun
                              .status ===
                            "SUCCEEDED"
                              ? "green"
                              : "amber"
                          }
                        >
                          {
                            rule.latestJobRun
                              .status
                          }
                        </Badge>
                        <span className="text-sm text-slate-300">
                          {
                            rule.latestJobRun
                              .processed
                          }{" "}
                          processed
                        </span>
                      </div>
                      <p className="mt-3 text-xs text-slate-500">
                        Last run{" "}
                        {formatDateTime(
                          rule.latestJobRun
                            .startedAt,
                        )}
                      </p>
                    </>
                  ) : (
                    <p className="mt-3 text-sm text-slate-400">
                      No recorded cron execution.
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-slate-700 bg-slate-950/35 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Latest simulation
                  </p>
                  {latestSimulation ? (
                    <>
                      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {details.map(
                          (detail) => (
                            <div
                              key={
                                detail.label
                              }
                            >
                              <p className="text-xl font-bold text-white">
                                {detail.value ??
                                  "—"}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {detail.label}
                              </p>
                            </div>
                          ),
                        )}
                      </div>
                      <p className="mt-4 text-xs text-emerald-400">
                        0 processed · 0 external
                        actions ·{" "}
                        {formatDateTime(
                          latestSimulation
                            .startedAt,
                        )}
                      </p>
                    </>
                  ) : (
                    <p className="mt-3 text-sm text-slate-400">
                      No simulation recorded yet.
                    </p>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
        <p className="font-semibold text-amber-200">
          Production execution is intentionally disabled
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          The existing server cron jobs continue to run
          independently. This workspace currently
          provides previews and immutable audit evidence
          only. Enabling a rule will require a separate,
          explicit approval workflow.
        </p>
      </section>
    </div>
  );
}
