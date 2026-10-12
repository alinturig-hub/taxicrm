import { storeApiResponse } from "./store";

import { prisma } from "@/lib/prisma";
import { getAutocabApiCredentials } from "@/lib/integrations/autocab/configuration";

export type GenericApiSyncResult = {
  endpointId: string;
  endpointName: string;
  received: number;
  eligible: number;
  created: number;
  updated: number;
  disabled: number;
  failed: number;
};

export async function syncGenericApiEndpoint(
  endpointId: string,
): Promise<GenericApiSyncResult> {
  const endpoint = await prisma.apiEndpointConfiguration.findUnique({
    where: {
      id: endpointId,
    },
  });

  if (!endpoint) {
    throw new Error("API endpoint configuration not found.");
  }

  if (endpoint.provider !== "AUTOCAB")
    throw new Error("This source is not an Autocab API endpoint.");

  if (!endpoint.isEnabled) {
    throw new Error("API endpoint is disabled.");
  }

  if (!endpoint.storeRecords) {
    throw new Error("Record storage is not enabled for this endpoint.");
  }

  const credentials = await getAutocabApiCredentials();

  const endpointUrl = new URL(endpoint.url);
  const configuredBaseUrl = new URL(credentials.baseUrl);

  if (endpointUrl.origin !== configuredBaseUrl.origin) {
    throw new Error(
      "Endpoint host does not match the configured Autocab host.",
    );
  }

  const response = await fetch(endpoint.url, {
    method: "GET",
    redirect: "error",
    signal: AbortSignal.timeout(60000),
    headers: {
      "Ocp-Apim-Subscription-Key": credentials.apiKey,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Autocab returned HTTP ${response.status}.`);
  }

  const payload: unknown = await response.json();

  const result = await storeApiResponse(
    endpoint.id,
    payload,
    endpoint.recordKey,
  );
  return { endpointId: endpoint.id, endpointName: endpoint.name, ...result };
}
