export type IntegrationStatus =
  | "CONNECTED"
  | "WARNING"
  | "OFFLINE";

export interface Integration {
  id: string;
  name: string;
  description: string;

  status: IntegrationStatus;

  icon?: string;

  lastSync: string | null;

  recordsToday: number;

  errorsToday: number;

  responseTimeMs: number | null;

  health: number;

  href: string;
}
