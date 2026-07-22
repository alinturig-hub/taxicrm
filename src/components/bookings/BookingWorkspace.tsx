"use client";

import BookingAIInsights from "./BookingAIInsights";
import BookingCompany from "./BookingCompany";
import BookingCustomer from "./BookingCustomer";
import BookingJourney from "./BookingJourney";
import BookingNotes from "./BookingNotes";
import BookingPricing from "./BookingPricing";
import BookingTimeline from "./BookingTimeline";
import BookingWebhookHistory from "./BookingWebhookHistory";
import BookingWorkspaceHeader from "./BookingWorkspaceHeader";
import { BookingWorkspaceData } from "./types";

type Props = {
  booking: BookingWorkspaceData | null;
  onOpenBooking?: (bookingId: string) => void;
};

export default function BookingWorkspace({
  booking,
  onOpenBooking,
}: Props) {
  if (!booking) {
    return (
      <aside className="flex h-full items-center justify-center border-l bg-slate-50">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-slate-700">
            Booking Workspace
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Select a booking to view details.
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="h-full overflow-y-auto border-l bg-slate-50">
      <BookingWorkspaceHeader booking={booking} />
      <BookingJourney booking={booking} />
      <BookingCustomer
        booking={booking}
        onOpenBooking={onOpenBooking}
      />
      <BookingCompany booking={booking} />
      <BookingPricing booking={booking} />
      <BookingNotes booking={booking} />
      <BookingTimeline booking={booking} />
      <BookingWebhookHistory booking={booking} />
      <BookingAIInsights booking={booking} />
    </aside>
  );
}
