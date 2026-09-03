"use client";

import type {
  FormEvent,
} from "react";
import {
  useRef,
  useState,
} from "react";

type Metric = {
  label: string;
  value: number;
  suffix?: string;
};

type Source = {
  label: string;
  href: string;
};

type CopilotAnswer = {
  headline: string;
  summary: string;
  metrics: Metric[];
  evidence: string[];
  sources: Source[];
  suggestions?: string[];
};

type CopilotResponse = {
  success: true;
  generatedAt: string;
  intent: string;
  answerType:
    | "VERIFIED"
    | "GENERAL_GUIDANCE"
    | "RESTRICTED";
  method: string;
  answer: CopilotAnswer;
  safeguards: {
    externalModelUsed: boolean;
    questionStored: boolean;
    writeActionsEnabled: boolean;
    customerContactEnabled: boolean;
  };
};

type Message =
  | {
      id: string;
      role: "USER";
      text: string;
    }
  | {
      id: string;
      role: "COPILOT";
      answer: CopilotAnswer;
      generatedAt: string;
      answerType:
        | "VERIFIED"
        | "GENERAL_GUIDANCE"
        | "RESTRICTED";
      method: string;
    };

const SUGGESTIONS = [
  "What is today revenue?",
  "How many bookings did we have yesterday?",
  "Compare revenue this week with last week",
  "How many drivers are online right now?",
  "How many bookings are expected in the next 24 hours?",
  "Why is there a forecast warning?",
  "How accurate are customer predictions?",
  "Is automation executing real actions?",
  "Are the intelligence jobs healthy?",
];

function messageId() {
  return [
    Date.now(),
    Math.random()
      .toString(36)
      .slice(2),
  ].join("-");
}

function formatValue(
  metric: Metric,
) {
  const value =
    new Intl.NumberFormat(
      "en-GB",
      {
        maximumFractionDigits: 1,
      },
    ).format(metric.value);

  return `${value}${
    metric.suffix ?? ""
  }`;
}

function formatDateTime(
  value: string,
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/London",
    },
  ).format(new Date(value));
}

export default function AICopilotWorkspace() {
  const [question, setQuestion] =
    useState("");
  const [messages, setMessages] =
    useState<Message[]>([]);
  const [loading, setLoading] =
    useState(false);
  const [error, setError] =
    useState<string | null>(null);
  const inputRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  async function ask(
    rawQuestion: string,
  ) {
    const normalized =
      rawQuestion.trim();

    if (
      !normalized ||
      loading
    ) {
      return;
    }

    const userMessage: Message = {
      id: messageId(),
      role: "USER",
      text: normalized,
    };

    setMessages(
      (current) => [
        ...current,
        userMessage,
      ],
    );
    setQuestion("");
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        "/api/dashboard/ai/copilot",
        {
          method: "POST",
          headers: {
            "content-type":
              "application/json",
          },
          body: JSON.stringify({
            question: normalized,
          }),
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
            "Copilot could not answer.",
        );
      }

      const result =
        payload as CopilotResponse;

      setMessages(
        (current) => [
          ...current,
          {
            id: messageId(),
            role: "COPILOT",
            answer:
              result.answer,
            generatedAt:
              result.generatedAt,
            answerType:
              result.answerType,
            method:
              result.method,
          },
        ],
      );
    } catch (askError) {
      setError(
        askError instanceof Error
          ? askError.message
          : "Copilot could not answer.",
      );
    } finally {
      setLoading(false);
      window.setTimeout(
        () =>
          inputRef.current
            ?.focus(),
        0,
      );
    }
  }

  function submit(
    event: FormEvent,
  ) {
    event.preventDefault();
    void ask(question);
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
              Evidence Copilot
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              Ask operational or general questions in English or
              Romanian. Verified answers use governed
              TaxiCRM records; general guidance is clearly
              labelled and does not claim live data.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              READ ONLY
            </span>
            <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300">
              VERIFIED SOURCES
            </span>
            <span className="rounded-full border border-slate-600 bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300">
              GROUNDED LLM + SAFE FALLBACK
            </span>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-700/70 bg-slate-900/70">
        <div className="min-h-[420px] space-y-5 p-5 md:p-7">
          {messages.length === 0 ? (
            <div className="mx-auto max-w-3xl py-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/30 bg-blue-500/10 text-2xl text-blue-300">
                ✦
              </div>
              <h2 className="mt-5 text-2xl font-bold text-white">
                What would you like to understand?
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                Copilot can explain revenue, bookings and period
                comparisons, live drivers and fleet activity,
                demand forecasts, verified warnings,
                prediction accuracy, automation safeguards
                and job health.
              </p>

              <div className="mt-7 grid gap-3 text-left md:grid-cols-2">
                {SUGGESTIONS.map(
                  (suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      disabled={loading}
                      onClick={() =>
                        void ask(
                          suggestion,
                        )
                      }
                      className="rounded-xl border border-slate-700 bg-slate-950/40 p-4 text-sm leading-6 text-slate-300 transition hover:border-blue-500/40 hover:bg-blue-500/5 disabled:opacity-50"
                    >
                      {suggestion}
                    </button>
                  ),
                )}
              </div>
            </div>
          ) : (
            messages.map(
              (message) =>
                message.role ===
                "USER" ? (
                  <div
                    key={message.id}
                    className="ml-auto max-w-3xl rounded-2xl rounded-br-md border border-blue-500/30 bg-blue-500/10 px-5 py-4"
                  >
                    <p className="text-sm leading-6 text-blue-100">
                      {message.text}
                    </p>
                  </div>
                ) : (
                  <article
                    key={message.id}
                    className="mr-auto max-w-4xl rounded-2xl rounded-bl-md border border-slate-700 bg-slate-950/45 p-5"
                  >
                    <p
                      className={`text-xs font-semibold uppercase tracking-[0.16em] ${
                        message.answerType ===
                        "RESTRICTED"
                          ? "text-amber-400"
                          : message.answerType ===
                              "GENERAL_GUIDANCE"
                            ? "text-violet-400"
                            : "text-blue-400"
                      }`}
                    >
                      {
                        message.answerType ===
                        "RESTRICTED"
                          ? "Restricted request"
                          : message.answerType ===
                              "GENERAL_GUIDANCE"
                            ? "General guidance"
                            : "Verified answer"
                      }
                    </p>
                    <h2 className="mt-3 text-xl font-bold text-white">
                      {
                        message.answer
                          .headline
                      }
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-slate-300">
                      {
                        message.answer
                          .summary
                      }
                    </p>

                    {message.answer
                      .metrics.length >
                    0 ? (
                      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {message.answer
                          .metrics.map(
                            (metric) => (
                              <div
                                key={
                                  metric.label
                                }
                                className="rounded-xl border border-slate-700 bg-slate-900/60 p-4"
                              >
                                <p className="text-2xl font-bold text-white">
                                  {formatValue(
                                    metric,
                                  )}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {
                                    metric.label
                                  }
                                </p>
                              </div>
                            ),
                          )}
                      </div>
                    ) : null}

                    <div className="mt-5 rounded-xl border border-slate-700/70 bg-slate-900/40 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Evidence
                      </p>
                      <ul className="mt-3 space-y-2">
                        {message.answer
                          .evidence.map(
                            (item) => (
                              <li
                                key={item}
                                className="flex gap-2 text-sm leading-6 text-slate-400"
                              >
                                <span className="text-blue-400">
                                  •
                                </span>
                                <span>
                                  {item}
                                </span>
                              </li>
                            ),
                          )}
                      </ul>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {message.answer
                        .sources.map(
                          (source) => (
                            <a
                              key={
                                source.href
                              }
                              href={
                                source.href
                              }
                              className="rounded-lg border border-blue-500/30 bg-blue-500/5 px-3 py-2 text-xs font-semibold text-blue-300 hover:bg-blue-500/10"
                            >
                              Open{" "}
                              {
                                source.label
                              }
                            </a>
                          ),
                        )}
                    </div>

                    <p className="mt-4 text-xs text-slate-600">
                      {
                        message.method
                      }{" "}
                      ·{" "}
                      {formatDateTime(
                        message.generatedAt,
                      )}
                    </p>
                  </article>
                ),
            )
          )}

          {loading ? (
            <div className="mr-auto rounded-2xl rounded-bl-md border border-slate-700 bg-slate-950/45 px-5 py-4 text-sm text-slate-400">
              Checking governed evidence…
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              {error}
            </div>
          ) : null}
        </div>

        <form
          onSubmit={submit}
          className="border-t border-slate-700/70 p-4 md:p-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              ref={inputRef}
              value={question}
              onChange={(event) =>
                setQuestion(
                  event.target.value,
                )
              }
              maxLength={500}
              placeholder="Ask about revenue, bookings, live drivers, demand, warnings or system health…"
              className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-blue-500/60"
            />
            <button
              type="submit"
              disabled={
                loading ||
                question.trim()
                  .length === 0
              }
              className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Ask Copilot
            </button>
          </div>

          <p className="mt-3 text-xs leading-5 text-slate-600">
            Questions are not stored. Copilot cannot
            modify data, execute jobs or contact
            customers.
          </p>
        </form>
      </section>
    </div>
  );
}
