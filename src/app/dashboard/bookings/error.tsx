"use client";

import { useEffect } from "react";

type BookingsErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function BookingsError({
  error,
  reset,
}: BookingsErrorProps) {
  useEffect(() => {
    console.error("Bookings page error:", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-4xl rounded-xl border border-red-500/40 bg-red-950/30 p-6">
        <h1 className="text-xl font-semibold text-red-300">
          Bookings runtime error
        </h1>

        <p className="mt-4 break-words font-mono text-sm text-red-100">
          {error.message || "Unknown client-side error"}
        </p>

        {error.stack ? (
          <pre className="mt-4 max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/40 p-4 text-xs text-slate-200">
            {error.stack}
          </pre>
        ) : null}

        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-950"
        >
          Retry
        </button>
      </div>
    </main>
  );
}
