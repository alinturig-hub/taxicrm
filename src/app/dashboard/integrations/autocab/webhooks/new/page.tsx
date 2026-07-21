"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ProcessingMode = "ALWAYS" | "WHEN_CONDITIONS_MATCH";
type ConditionMode = "ALL" | "ANY";

type ConditionOperator =
  | "EQUALS"
  | "NOT_EQUALS"
  | "CONTAINS"
  | "NOT_CONTAINS"
  | "EXISTS"
  | "NOT_EXISTS"
  | "GREATER_THAN"
  | "GREATER_THAN_OR_EQUALS"
  | "LESS_THAN"
  | "LESS_THAN_OR_EQUALS"
  | "IN"
  | "NOT_IN";

type ConditionForm = {
  id: string;
  fieldPath: string;
  operator: ConditionOperator;
  expectedValue: string;
  isEnabled: boolean;
};

type ApiErrorResponse = {
  error?: string;
  message?: string;
};

const OPERATORS: Array<{
  value: ConditionOperator;
  label: string;
}> = [
  { value: "EQUALS", label: "Equals" },
  { value: "NOT_EQUALS", label: "Does not equal" },
  { value: "CONTAINS", label: "Contains" },
  { value: "NOT_CONTAINS", label: "Does not contain" },
  { value: "EXISTS", label: "Exists" },
  { value: "NOT_EXISTS", label: "Does not exist" },
  { value: "GREATER_THAN", label: "Greater than" },
  {
    value: "GREATER_THAN_OR_EQUALS",
    label: "Greater than or equals",
  },
  { value: "LESS_THAN", label: "Less than" },
  {
    value: "LESS_THAN_OR_EQUALS",
    label: "Less than or equals",
  },
  { value: "IN", label: "Is one of" },
  { value: "NOT_IN", label: "Is not one of" },
];

const VALUELESS_OPERATORS: ConditionOperator[] = [
  "EXISTS",
  "NOT_EXISTS",
];

function createCondition(): ConditionForm {
  return {
    id: crypto.randomUUID(),
    fieldPath: "",
    operator: "EQUALS",
    expectedValue: "",
    isEnabled: true,
  };
}

function normalizeEndpointPreview(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeEventCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export default function NewAutocabWebhookPage() {
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [eventType, setEventType] = useState("");
  const [endpointSlug, setEndpointSlug] = useState("");
  const [description, setDescription] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);
  const [processingMode, setProcessingMode] =
    useState<ProcessingMode>("ALWAYS");
  const [conditionMode, setConditionMode] =
    useState<ConditionMode>("ALL");
  const [conditions, setConditions] = useState<ConditionForm[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const endpointPreview = useMemo(
    () => normalizeEndpointPreview(endpointSlug),
    [endpointSlug],
  );

  const eventCodePreview = useMemo(
    () => normalizeEventCode(eventType),
    [eventType],
  );

  function addCondition() {
    setConditions((current) => [...current, createCondition()]);
  }

  function removeCondition(id: string) {
    setConditions((current) =>
      current.filter((condition) => condition.id !== id),
    );
  }

  function updateCondition(
    id: string,
    updates: Partial<ConditionForm>,
  ) {
    setConditions((current) =>
      current.map((condition) =>
        condition.id === id
          ? {
              ...condition,
              ...updates,
            }
          : condition,
      ),
    );
  }

  function changeProcessingMode(value: ProcessingMode) {
    setProcessingMode(value);

    if (
      value === "WHEN_CONDITIONS_MATCH" &&
      conditions.length === 0
    ) {
      setConditions([createCondition()]);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch(
        "/api/dashboard/autocab/webhooks",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            displayName,
            eventType,
            endpointSlug,
            description,
            isEnabled,
            processingMode,
            conditionMode,
            conditions:
              processingMode === "WHEN_CONDITIONS_MATCH"
                ? conditions.map((condition, index) => ({
                    fieldPath: condition.fieldPath,
                    operator: condition.operator,
                    expectedValue: VALUELESS_OPERATORS.includes(
                      condition.operator,
                    )
                      ? undefined
                      : condition.expectedValue,
                    position: index,
                    isEnabled: condition.isEnabled,
                  }))
                : [],
          }),
        },
      );

      if (!response.ok) {
        const error =
          (await response.json()) as ApiErrorResponse;

        throw new Error(
          error.message ??
            "Webhook configuration could not be created.",
        );
      }

      router.push(
        "/dashboard/integrations/autocab/webhooks",
      );
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Webhook configuration could not be created.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-blue-400">
            Autocab Webhook Manager
          </p>

          <h1 className="mt-2 text-4xl font-bold text-white">
            Add Autocab Webhook
          </h1>

          <p className="mt-3 text-slate-400">
            Configurează endpoint-ul public, identificatorul intern și
            regulile de procesare.
          </p>
        </div>

        <Link
          href="/dashboard/integrations/autocab/webhooks"
          className="inline-flex items-center justify-center rounded-lg border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
        >
          Back to Webhooks
        </Link>
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-300">
          {errorMessage}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 px-6 py-5">
          <h2 className="text-xl font-semibold text-white">
            General
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            Identitatea și adresa publică a webhook-ului.
          </p>
        </div>

        <div className="grid gap-6 p-6 lg:grid-cols-2">
          <div>
            <label
              htmlFor="displayName"
              className="mb-2 block text-sm font-medium text-slate-300"
            >
              Display Name
            </label>

            <input
              id="displayName"
              type="text"
              required
              value={displayName}
              onChange={(event) =>
                setDisplayName(event.target.value)
              }
              placeholder="New Booking"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="eventType"
              className="mb-2 block text-sm font-medium text-slate-300"
            >
              Event Code
            </label>

            <input
              id="eventType"
              type="text"
              required
              value={eventType}
              onChange={(event) =>
                setEventType(event.target.value)
              }
              placeholder="AUTOCAB_NEW_BOOKING"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 font-mono text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500"
            />

            <p className="mt-2 text-xs text-slate-500">
              Internal code:{" "}
              <span className="font-mono text-blue-400">
                {eventCodePreview || "AUTOCAB_NEW_BOOKING"}
              </span>
            </p>
          </div>

          <div className="lg:col-span-2">
            <label
              htmlFor="endpointSlug"
              className="mb-2 block text-sm font-medium text-slate-300"
            >
              Endpoint Slug
            </label>

            <div className="flex overflow-hidden rounded-lg border border-slate-700 bg-slate-950 focus-within:border-blue-500">
              <span className="hidden items-center border-r border-slate-700 px-4 text-sm text-slate-500 md:flex">
                https://taxicrm.plymhub.ai/api/webhooks/autocab/
              </span>

              <input
                id="endpointSlug"
                type="text"
                required
                value={endpointSlug}
                onChange={(event) =>
                  setEndpointSlug(event.target.value)
                }
                placeholder="newbooking"
                className="min-w-0 flex-1 bg-transparent px-4 py-3 font-mono text-white outline-none placeholder:text-slate-600"
              />
            </div>

            <code className="mt-3 block overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-emerald-400">
              https://taxicrm.plymhub.ai/api/webhooks/autocab/
              {endpointPreview || "newbooking"}
            </code>
          </div>

          <div className="lg:col-span-2">
            <label
              htmlFor="description"
              className="mb-2 block text-sm font-medium text-slate-300"
            >
              Description
            </label>

            <textarea
              id="description"
              rows={4}
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              placeholder="Receives new booking events from Autocab."
              className="w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500"
            />
          </div>

          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-700 bg-slate-950 p-4 lg:col-span-2">
            <div>
              <p className="font-medium text-white">
                Enable Webhook
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Webhook-ul va accepta și procesa evenimente imediat.
              </p>
            </div>

            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(event) =>
                setIsEnabled(event.target.checked)
              }
              className="h-5 w-5 rounded border-slate-600 bg-slate-900 text-blue-600"
            />
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 px-6 py-5">
          <h2 className="text-xl font-semibold text-white">
            Processing
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            Decide când este permisă procesarea payload-ului.
          </p>
        </div>

        <div className="grid gap-4 p-6 lg:grid-cols-2">
          <button
            type="button"
            onClick={() => changeProcessingMode("ALWAYS")}
            className={`rounded-xl border p-5 text-left transition ${
              processingMode === "ALWAYS"
                ? "border-blue-500 bg-blue-500/10"
                : "border-slate-700 bg-slate-950 hover:border-slate-600"
            }`}
          >
            <p className="font-semibold text-white">
              Always Process
            </p>

            <p className="mt-2 text-sm text-slate-400">
              Fiecare payload valid este trimis către procesor.
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              changeProcessingMode(
                "WHEN_CONDITIONS_MATCH",
              )
            }
            className={`rounded-xl border p-5 text-left transition ${
              processingMode === "WHEN_CONDITIONS_MATCH"
                ? "border-blue-500 bg-blue-500/10"
                : "border-slate-700 bg-slate-950 hover:border-slate-600"
            }`}
          >
            <p className="font-semibold text-white">
              Process Only If Conditions Match
            </p>

            <p className="mt-2 text-sm text-slate-400">
              Payload-ul este procesat numai când regulile sunt
              îndeplinite.
            </p>
          </button>
        </div>
      </section>

      {processingMode === "WHEN_CONDITIONS_MATCH" ? (
        <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          <div className="flex flex-col gap-4 border-b border-slate-800 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">
                Conditions
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Verifică valori din payload folosind căi precum{" "}
                <code className="text-blue-400">
                  booking.paymentType
                </code>
                .
              </p>
            </div>

            <button
              type="button"
              onClick={addCondition}
              className="inline-flex items-center justify-center rounded-lg border border-blue-500 px-4 py-2 text-sm font-semibold text-blue-400 transition hover:bg-blue-500/10"
            >
              Add Condition
            </button>
          </div>

          <div className="space-y-5 p-6">
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-400">
                Match
              </span>

              <select
                value={conditionMode}
                onChange={(event) =>
                  setConditionMode(
                    event.target.value as ConditionMode,
                  )
                }
                className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-white outline-none focus:border-blue-500"
              >
                <option value="ALL">
                  All conditions (AND)
                </option>
                <option value="ANY">
                  Any condition (OR)
                </option>
              </select>
            </div>

            {conditions.map((condition, index) => {
              const requiresValue =
                !VALUELESS_OPERATORS.includes(
                  condition.operator,
                );

              return (
                <div
                  key={condition.id}
                  className="rounded-xl border border-slate-700 bg-slate-950 p-5"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-300">
                      Condition {index + 1}
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        removeCondition(condition.id)
                      }
                      className="text-sm font-medium text-red-400 transition hover:text-red-300"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[1fr_240px_1fr_auto]">
                    <input
                      type="text"
                      required
                      value={condition.fieldPath}
                      onChange={(event) =>
                        updateCondition(condition.id, {
                          fieldPath: event.target.value,
                        })
                      }
                      placeholder="booking.accountId"
                      className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 font-mono text-sm text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
                    />

                    <select
                      value={condition.operator}
                      onChange={(event) =>
                        updateCondition(condition.id, {
                          operator: event.target
                            .value as ConditionOperator,
                        })
                      }
                      className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
                    >
                      {OPERATORS.map((operator) => (
                        <option
                          key={operator.value}
                          value={operator.value}
                        >
                          {operator.label}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      required={requiresValue}
                      disabled={!requiresValue}
                      value={condition.expectedValue}
                      onChange={(event) =>
                        updateCondition(condition.id, {
                          expectedValue: event.target.value,
                        })
                      }
                      placeholder={
                        requiresValue
                          ? "Expected value"
                          : "No value required"
                      }
                      className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                    />

                    <label className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-4 py-3 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={condition.isEnabled}
                        onChange={(event) =>
                          updateCondition(condition.id, {
                            isEnabled:
                              event.target.checked,
                          })
                        }
                        className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-blue-600"
                      />
                      Active
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 px-6 py-5">
          <h2 className="text-xl font-semibold text-white">
            Actions
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            Acțiunile configurabile vor fi implementate în etapa
            următoare.
          </p>
        </div>

        <div className="grid gap-3 p-6 sm:grid-cols-2 xl:grid-cols-4">
          {[
            "Create Booking",
            "Update Booking",
            "Create Timeline Event",
            "Send Notification",
            "Run Workflow",
            "Execute AI",
            "HTTP Request",
            "Execute Script",
          ].map((action) => (
            <label
              key={action}
              className="flex cursor-not-allowed items-center gap-3 rounded-lg border border-slate-800 bg-slate-950 p-4 opacity-50"
            >
              <input
                type="checkbox"
                disabled
                className="h-4 w-4 rounded border-slate-600 bg-slate-900"
              />

              <span className="text-sm text-slate-300">
                {action}
              </span>
            </label>
          ))}
        </div>
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          href="/dashboard/integrations/autocab/webhooks"
          className="inline-flex items-center justify-center rounded-lg border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
        >
          Cancel
        </Link>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting
            ? "Creating Webhook..."
            : "Create Webhook"}
        </button>
      </div>
    </form>
  );
}
