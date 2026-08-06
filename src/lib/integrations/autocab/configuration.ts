import { prisma } from "@/lib/prisma";
import {
  decryptSecret,
  encryptSecret,
} from "@/lib/security/encryption";

const PROVIDER = "AUTOCAB";
const DEFAULT_BASE_URL =
  "https://autocab-api.azure-api.net";

export type PublicAutocabConfiguration = {
  id: string | null;
  provider: string;
  baseUrl: string;
  isEnabled: boolean;
  hasApiKey: boolean;
  apiKeyLastFour: string | null;
  lastTestedAt: Date | null;
  lastSuccessfulSyncAt: Date | null;
  lastError: string | null;
  updatedAt: Date | null;
};

export type SaveAutocabConfigurationInput = {
  baseUrl: string;
  apiKey?: string;
  isEnabled: boolean;
};

function normaliseBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");

  const url = new URL(trimmed);

  if (!["https:", "http:"].includes(url.protocol)) {
    throw new Error(
      "Autocab base URL must use HTTP or HTTPS.",
    );
  }

  return url.toString().replace(/\/+$/, "");
}

export async function getPublicAutocabConfiguration():
Promise<PublicAutocabConfiguration> {
  const configuration =
    await prisma.autocabApiConfiguration.findUnique({
      where: {
        provider: PROVIDER,
      },
    });

  if (!configuration) {
    return {
      id: null,
      provider: PROVIDER,
      baseUrl: DEFAULT_BASE_URL,
      isEnabled: false,
      hasApiKey: false,
      apiKeyLastFour: null,
      lastTestedAt: null,
      lastSuccessfulSyncAt: null,
      lastError: null,
      updatedAt: null,
    };
  }

  return {
    id: configuration.id,
    provider: configuration.provider,
    baseUrl: configuration.baseUrl,
    isEnabled: configuration.isEnabled,
    hasApiKey:
      configuration.apiKeyEncrypted !== null,
    apiKeyLastFour:
      configuration.apiKeyLastFour,
    lastTestedAt:
      configuration.lastTestedAt,
    lastSuccessfulSyncAt:
      configuration.lastSuccessfulSyncAt,
    lastError: configuration.lastError,
    updatedAt: configuration.updatedAt,
  };
}

export async function saveAutocabConfiguration(
  input: SaveAutocabConfigurationInput,
): Promise<PublicAutocabConfiguration> {
  const baseUrl = normaliseBaseUrl(input.baseUrl);
  const apiKey = input.apiKey?.trim();

  const existing =
    await prisma.autocabApiConfiguration.findUnique({
      where: {
        provider: PROVIDER,
      },
    });

  if (!existing && !apiKey) {
    throw new Error(
      "An API key is required for initial configuration.",
    );
  }

  const apiKeyData = apiKey
    ? {
        apiKeyEncrypted: encryptSecret(apiKey),
        apiKeyLastFour: apiKey.slice(-4),
      }
    : {};

  await prisma.autocabApiConfiguration.upsert({
    where: {
      provider: PROVIDER,
    },
    create: {
      provider: PROVIDER,
      baseUrl,
      isEnabled: input.isEnabled,
      ...apiKeyData,
    },
    update: {
      baseUrl,
      isEnabled: input.isEnabled,
      ...apiKeyData,
    },
  });

  return getPublicAutocabConfiguration();
}

export async function getStoredAutocabApiCredentials() {
  const configuration =
    await prisma.autocabApiConfiguration.findUnique({
      where: {
        provider: PROVIDER,
      },
    });

  if (
    !configuration ||
    !configuration.apiKeyEncrypted
  ) {
    throw new Error(
      "Autocab REST API credentials have not been saved.",
    );
  }

  return {
    baseUrl: configuration.baseUrl,
    apiKey: decryptSecret(
      configuration.apiKeyEncrypted,
    ),
    isEnabled: configuration.isEnabled,
  };
}

export async function getAutocabApiCredentials() {
  const configuration =
    await prisma.autocabApiConfiguration.findUnique({
      where: {
        provider: PROVIDER,
      },
    });

  if (
    !configuration ||
    !configuration.isEnabled ||
    !configuration.apiKeyEncrypted
  ) {
    throw new Error(
      "Autocab REST integration is not configured or enabled.",
    );
  }

  return {
    baseUrl: configuration.baseUrl,
    apiKey: decryptSecret(
      configuration.apiKeyEncrypted,
    ),
  };
}

export async function recordAutocabConnectionResult(
  successful: boolean,
  error?: string,
) {
  await prisma.autocabApiConfiguration.update({
    where: {
      provider: PROVIDER,
    },
    data: {
      lastTestedAt: new Date(),
      lastError: successful
        ? null
        : error ?? "Connection test failed.",
      ...(successful
        ? {
            lastSuccessfulSyncAt: new Date(),
          }
        : {}),
    },
  });
}
