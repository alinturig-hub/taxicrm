import AutocabApiConfigurationForm from "@/components/integrations/autocab/AutocabApiConfigurationForm";

export const dynamic = "force-dynamic";

export default function AutocabIntegrationPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-[0.25em] text-blue-400">
          Integrations
        </p>

        <h1 className="mt-2 text-4xl font-bold text-white">
          Autocab REST Integration
        </h1>

        <p className="mt-3 max-w-3xl text-slate-400">
          Configurează conexiunea REST Autocab și gestionează
          sincronizarea datelor master pentru șoferi, vehicule
          și alte entități.
        </p>
      </div>

      <AutocabApiConfigurationForm />
    </div>
  );
}
