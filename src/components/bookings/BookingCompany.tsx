"use client";

import { BookingWorkspaceData } from "./types";

type Props = {
  booking: BookingWorkspaceData;
};

export default function BookingCompany({ booking }: Props) {
  return (
    <div className="border-b bg-white p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Company
      </h3>

      <div className="space-y-4">

        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">
            Company
          </p>

          <p className="font-medium">
            {booking.companyName ?? "-"}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">
            Account
          </p>

          <p className="font-medium">
            {booking.accountName ?? "-"}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">
            Payment Type
          </p>

          <p className="font-medium">
            {booking.paymentType ?? "-"}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">
            Booking Source
          </p>

          <p className="font-medium">
            {booking.bookingSource ?? "-"}
          </p>
        </div>

      </div>
    </div>
  );
}
