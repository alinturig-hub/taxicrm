// Draft persistence is opt-in; deploying the UI never migrates the shared database.
export function connectionRegistryEnabled(settings: Record<string, string | undefined> = process.env) {
  return settings.CONNECTION_REGISTRY_ENABLED === "true";
}
export type DataSource = "NEEDACABPLUS" | "AUTOCAB" | "LOCAL";
export type ConnectionPlan = {
  version: 1;
  companyName: string;
  source: DataSource;
  storage: "CURRENT_DATABASE" | "DEDICATED_DATABASE";
  status: "DRAFT";
  businessTimezone: "Europe/London";
  preserveExistingConnection: true;
  requirements: string[];
};

export function createConnectionPlan(input: {
  companyName: string;
  source: string;
  storage: string;
}): ConnectionPlan {
  const companyName = input.companyName.trim();
  if (!companyName || companyName.length > 120)
    throw new Error("Enter a company name of up to 120 characters.");
  if (!["NEEDACABPLUS", "AUTOCAB", "LOCAL"].includes(input.source))
    throw new Error("Choose a supported data source.");
  if (!["CURRENT_DATABASE", "DEDICATED_DATABASE"].includes(input.storage))
    throw new Error("Choose a storage plan.");
  const requirements = [
    "Confirm the current database owner and booking writer before activation.",
    "Approve company isolation and connection-scoped external identifiers.",
    "Keep original payloads and existing provider + accountId financial rules.",
    "Compare synthetic results before any connection cutover.",
  ];
  if (input.source === "NEEDACABPLUS") requirements.push(
    "Verify the existing NeedACabPlus transport and its API/webhook contract; do not replace it.",
  );
  if (input.source === "AUTOCAB") requirements.push(
    "Confirm exclusive booking ownership and cross-provider booking references before enabling direct intake.",
  );
  if (input.source === "LOCAL") requirements.push(
    "Define the import format or local system protocol and implement its adapter.",
  );
  if (input.storage === "DEDICATED_DATABASE") requirements.push(
    "Provision and validate a separate database with an approved migration and rollback plan.",
  );
  return {
    version: 1, companyName, source: input.source as DataSource,
    storage: input.storage as ConnectionPlan["storage"], status: "DRAFT",
    businessTimezone: "Europe/London", preserveExistingConnection: true, requirements,
  };
}

export function connectionOwnership(settings: Record<string, string | undefined>) {
  return {
    bookingWriter: settings.BOOKING_WEBHOOK_WRITER === "NAC" ? "NeedACabPlus" : "TaxiCRM",
    directIntakePaused: settings.AUTOCAB_WEBHOOKS_PAUSED === "true",
    externallyManagedSchema: settings.DATABASE_SCHEMA_MANAGED_EXTERNALLY === "true",
  };
}
