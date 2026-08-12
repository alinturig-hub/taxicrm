import AccountRevenueRules from "@/components/configuration/AccountRevenueRules";

export const dynamic = "force-dynamic";

export default function AccountsConfigurationPage() {
  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-400">
          Revenue Configuration
        </p>

        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">
          Accounts
        </h1>

        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          Configure waiting-time charging for
          account No Fare jobs. Completed jobs
          continue to use the final Autocab total.
          Waiting is calculated from Driver At
          Pickup to No Fare only for accounts
          enabled below.
        </p>

        <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3">
          <p className="text-sm text-blue-200">
            Default waiting rate: £0.30 per minute.
            Time is not rounded; only the final
            monetary amount is rounded to 2 decimal
            places.
          </p>
        </div>
      </section>

      <AccountRevenueRules />
    </div>
  );
}
