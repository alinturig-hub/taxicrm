"use client";

import { BookingWorkspaceData } from "./types";

type Props = {
  booking: BookingWorkspaceData;
};

export default function BookingWebhookHistory({}: Props) {
  return (
    <div className="border-b bg-white p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Webhook History
      </h3>

      <div className="rounded-lg border border-dashed p-4 text-sm text-slate-500">
        Webhook history will be connected in the next step using the
        WebhookEvent table.
      </div>
    </div>
  );
}
