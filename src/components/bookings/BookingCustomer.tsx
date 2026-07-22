"use client";

import { BookingWorkspaceData } from "./types";

type Props = {
  booking: BookingWorkspaceData;
};

export default function BookingCustomer({ booking }: Props) {
  return (
    <div className="border-b bg-white p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Customer
      </h3>

      <div className="space-y-4">

        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">
            Name
          </p>

          <p className="font-medium">
            {booking.customerName ?? "-"}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">
            Telephone
          </p>

          <p className="font-medium">
            {booking.telephoneNumber ?? "-"}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">
            Email
          </p>

          <p className="font-medium break-all">
            {booking.customerEmail ?? "-"}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">
            Reference
          </p>

          <p className="font-medium">
            {booking.ourReference ?? "-"}
          </p>
        </div>

      </div>
    </div>
  );
}
