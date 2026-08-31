"use client";

import { useState } from "react";

import CustomerPredictionsDashboard from "@/components/customers/CustomerPredictionsDashboard";
import CustomerProfileDrawer from "@/components/customers/CustomerProfileDrawer";

export default function AIPredictionsWorkspace() {
  const [
    selectedCustomerId,
    setSelectedCustomerId,
  ] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-blue-500/20 bg-slate-900/70 p-6 shadow-xl shadow-black/10">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-400">
              AI Center
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">
              Predictions
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              Verified booking-demand forecasts and
              customer prediction signals from one
              governed source. Historical backtests and
              live results remain clearly separated.
            </p>
          </div>

          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
            <p className="text-sm font-semibold text-emerald-300">
              Evidence-based
            </p>
            <p className="mt-1 text-xs text-emerald-400/70">
              Unique bookings · measured outcomes
            </p>
          </div>
        </div>
      </section>

      <CustomerPredictionsDashboard
        onOpenCustomer={(
          customerId,
        ) =>
          setSelectedCustomerId(
            customerId,
          )
        }
      />

      {selectedCustomerId ? (
        <CustomerProfileDrawer
          customerId={
            selectedCustomerId
          }
          onClose={() =>
            setSelectedCustomerId(null)
          }
        />
      ) : null}
    </div>
  );
}
