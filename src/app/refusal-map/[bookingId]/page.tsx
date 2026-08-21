import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getRefusalDetail } from "@/lib/refusals/refusal-map";
import RefusalMap from "@/components/refusals/RefusalMap";

export const dynamic = "force-dynamic";

export default async function RefusalMapPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  const { bookingId } = await params;
  const detail = await getRefusalDetail(bookingId);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">
          Refuz job — unde era șoferul vs pickup
        </h1>
        <p className="text-sm text-slate-400">
          {detail ? `Booking ${detail.externalId}` : `Booking ${bookingId}`}
          {detail?.refusedAt
            ? ` · refuzat ${new Date(detail.refusedAt).toLocaleString("ro-RO")}`
            : ""}
        </p>
      </div>

      {detail ? (
        <RefusalMap detail={detail} />
      ) : (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-6 text-red-200">
          Booking-ul nu a fost găsit sau nu are date de refuz.
        </div>
      )}
    </main>
  );
}
