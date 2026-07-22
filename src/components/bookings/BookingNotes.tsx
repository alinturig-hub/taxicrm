"use client";

import { BookingWorkspaceData } from "./types";

type Props = {
  booking: BookingWorkspaceData;
};

function Note({
  title,
  value,
}: {
  title: string;
  value: string | null;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase text-slate-500">
        {title}
      </p>

      <div className="rounded-lg border bg-slate-50 p-3 text-sm whitespace-pre-wrap">
        {value?.trim() || "-"}
      </div>
    </div>
  );
}

export default function BookingNotes({ booking }: Props) {
  return (
    <div className="border-b bg-white p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Notes
      </h3>

      <div className="space-y-5">
        <Note
          title="Driver Note"
          value={booking.driverNote}
        />

        <Note
          title="Office Note"
          value={booking.officeNote}
        />
      </div>
    </div>
  );
}
