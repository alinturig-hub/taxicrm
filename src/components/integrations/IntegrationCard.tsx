"use client";

import Link from "next/link";
import { Integration } from "./types";

type Props = {
  integration: Integration;
};

function statusColor(status: Integration["status"]) {
  switch (status) {
    case "CONNECTED":
      return "bg-emerald-500";
    case "WARNING":
      return "bg-amber-500";
    case "OFFLINE":
      return "bg-red-500";
  }
}

function statusLabel(status: Integration["status"]) {
  switch (status) {
    case "CONNECTED":
      return "Connected";
    case "WARNING":
      return "Warning";
    case "OFFLINE":
      return "Offline";
  }
}

export default function IntegrationCard({
  integration,
}: Props) {
  return (
    <Link
      href={integration.href}
      className="block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {integration.name}
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            {integration.description}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`h-3 w-3 rounded-full ${statusColor(
              integration.status,
            )}`}
          />

          <span className="text-sm font-medium text-slate-700">
            {statusLabel(integration.status)}
          </span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-slate-500">Last Sync</div>
          <div className="mt-1 font-semibold">
            {integration.lastSync ?? "-"}
          </div>
        </div>

        <div>
          <div className="text-slate-500">Health</div>
          <div className="mt-1 font-semibold">
            {integration.health}%
          </div>
        </div>

        <div>
          <div className="text-slate-500">Records Today</div>
          <div className="mt-1 font-semibold">
            {integration.recordsToday.toLocaleString()}
          </div>
        </div>

        <div>
          <div className="text-slate-500">Errors</div>
          <div className="mt-1 font-semibold">
            {integration.errorsToday}
          </div>
        </div>
      </div>
    </Link>
  );
}
