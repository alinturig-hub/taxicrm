import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getDriverRefusals } from "@/lib/refusals/refusal-map";
import DriverRefusalsMap from "@/components/refusals/DriverRefusalsMap";

export const dynamic = "force-dynamic";

export default async function DriverRefusalsPage({
  params,
}: {
  params: Promise<{ callsign: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  const { callsign } = await params;
  const refusals = await getDriverRefusals(callsign);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">
          Refuzuri șofer #{callsign}
        </h1>
        <p className="text-sm text-slate-400">
          Unde era șoferul când a refuzat vs pickup-ul joburilor · {refusals.length} refuzuri
        </p>
      </div>

      <DriverRefusalsMap callsign={callsign} refusals={refusals} />
    </main>
  );
}
