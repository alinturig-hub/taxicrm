"use client";

import { BookingWorkspaceData } from "./types";

type Props = {
  booking: BookingWorkspaceData;
};

export default function BookingAIInsights({}: Props) {
  return (
    <div className="bg-white p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        AI Insights
      </h3>

      <div className="rounded-lg border border-dashed p-4">
        <ul className="space-y-2 text-sm text-slate-600">
          <li>🤖 AI insights will appear here.</li>
          <li>• Customer risk score</li>
          <li>• Fraud detection</li>
          <li>• VIP recognition</li>
          <li>• Flight monitoring</li>
          <li>• Duplicate booking detection</li>
          <li>• Smart recommendations</li>
        </ul>
      </div>
    </div>
  );
}
