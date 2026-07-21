"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ApiErrorResponse = {
  error?: string;
  message?: string;
};

function normalizeEndpointPreview(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeEventCode(value: string): string {
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const endpointPreview = useMemo(
    () => normalizeEndpointPreview(endpointSlug),
    [endpointSlug],
  );

  const eventCodePreview = useMemo(
    () => normalizeEventCode(eventType),
    [eventType],
  );

  const webhookUrl = `https://taxicrm.plymhub.ai/api/webhooks/autocab/${
    endpointPreview || "newbooking"
  }`;

  async function copyWebhookUrl() {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      setErrorMessage("Webhook URL could not be copied.");
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
            processingMode: "ALWAYS",
            conditionMode: "ALL",
            conditions: [],
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
            Autocab Data Ingestion
          </p>

          <h1 className="mt-2 text-4xl font-bold text-white">
            Add Autocab Webhook
          </h1>

          <p className="mt-3 max-w-3xl text-slate-400">
            Creează un endpoint public pentru colectarea și
            arhivarea completă a evenimentelor primite de la
            Autocab.
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

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 px-6 py-5">
            <h2 className="text-xl font-semibold text-white">
              Webhook Configuration
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Definește identitatea webhook-ului și URL-ul care va
              fi introdus în portalul Autocab.
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
                Internal Event Code
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
                Saved as:{" "}
                <span className="font-mono text-blue-400">
                  {eventCodePreview ||
                    "AUTOCAB_NEW_BOOKING"}
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
                placeholder="Receives and stores all new booking events from Autocab."
                className="w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500"
              />
            </div>

            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-700 bg-slate-950 p-4 lg:col-span-2">
              <div>
                <p className="font-medium text-white">
                  Enable Webhook
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Când este activ, endpoint-ul poate primi și salva
                  evenimente Autocab.
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

        <aside className="space-y-6">
          <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            <div className="border-b border-slate-800 px-5 py-4">
              <h2 className="font-semibold text-white">
                Webhook URL
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Copiază acest URL în portalul Autocab.
              </p>
            </div>

            <div className="space-y-4 p-5">
              <code className="block overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-4 text-xs leading-6 text-emerald-400">
                {webhookUrl}
              </code>

              <button
                type="button"
                onClick={copyWebhookUrl}
                className="inline-flex w-full items-center justify-center rounded-lg border border-blue-500 px-4 py-3 text-sm font-semibold text-blue-400 transition hover:bg-blue-500/10"
              >
                {copied ? "URL Copied" : "Copy Webhook URL"}
              </button>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            <div className="border-b border-slate-800 px-5 py-4">
              <h2 className="font-semibold text-white">
                Data Collection
              </h2>
            </div>

            <div className="space-y-4 p-5 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400">Status</span>
                <span
                  className={
                    isEnabled
                      ? "font-semibold text-emerald-400"
                      : "font-semibold text-slate-500"
                  }
                >
                  {isEnabled ? "Enabled" : "Disabled"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400">
                  Collection mode
                </span>
                <span className="font-semibold text-white">
                  Store all events
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400">Filters</span>
                <span className="font-semibold text-white">
                  None
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400">
                  Payload storage
                </span>
                <span className="font-semibold text-white">
                  Raw JSON
                </span>
              </div>
            </div>
          </section>

          <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-5 text-sm leading-6 text-blue-200">
            Toate payload-urile primite prin acest endpoint vor fi
            păstrate integral. Filtrarea și clasificarea vor fi
            aplicate ulterior în stratul de analytics.
          </div>
        </aside>
      </div>

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
