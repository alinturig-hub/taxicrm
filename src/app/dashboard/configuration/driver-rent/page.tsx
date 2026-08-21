import DriverRentSettings from "@/components/configuration/DriverRentSettings";

export const dynamic = "force-dynamic";

export default function DriverRentConfigurationPage() {
  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-400">
          Driver Configuration
        </p>

        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">
          Driver Rent
        </h1>

        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          Configure the global weekly rent
          percentage and maximum cap applied to
          driver earnings.
        </p>
      </section>

      <DriverRentSettings />
    </div>
  );
}
