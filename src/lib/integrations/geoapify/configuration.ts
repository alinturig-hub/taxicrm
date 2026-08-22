import { prisma } from "@/lib/prisma";
import {
  decryptSecret,
  encryptSecret,
} from "@/lib/security/encryption";

const PROVIDER = "GEOAPIFY";
const DEFAULT_BASE_URL =
  "https://api.geoapify.com";
const DEFAULT_DAILY_LIMIT = 3000;

export type PublicGeoapifyConfiguration = {
  id: string | null;
  provider: string;
  baseUrl: string;
  isEnabled: boolean;
  hasApiKey: boolean;
  apiKeyLastFour: string | null;
  dailyLimit: number;
  dailyUsed: number;
  usageDate: Date | null;
  lastTestedAt: Date | null;
  lastSuccessfulLookupAt: Date | null;
  lastError: string | null;
  updatedAt: Date | null;
};

export type SaveGeoapifyConfigurationInput = {
  baseUrl: string;
  apiKey?: string;
  isEnabled: boolean;
  dailyLimit: number;
};

function normaliseBaseUrl(value: string) {
  const trimmed =
    value.trim().replace(/\/+$/, "");
  const url = new URL(trimmed);

  if (url.protocol !== "https:") {
    throw new Error(
      "Geoapify base URL must use HTTPS.",
    );
  }

  return url.toString().replace(/\/+$/, "");
}

function validateDailyLimit(value: number) {
  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > 3000
  ) {
    throw new Error(
      "Daily request limit must be between 1 and 3000.",
    );
  }

  return value;
}

export async function getPublicGeoapifyConfiguration():
Promise<PublicGeoapifyConfiguration> {
  const configuration =
    await prisma.geoapifyApiConfiguration.findUnique({
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
      dailyLimit: DEFAULT_DAILY_LIMIT,
      dailyUsed: 0,
      usageDate: null,
      lastTestedAt: null,
      lastSuccessfulLookupAt: null,
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
    dailyLimit: configuration.dailyLimit,
    dailyUsed: configuration.dailyUsed,
    usageDate: configuration.usageDate,
    lastTestedAt:
      configuration.lastTestedAt,
    lastSuccessfulLookupAt:
      configuration.lastSuccessfulLookupAt,
    lastError: configuration.lastError,
    updatedAt: configuration.updatedAt,
  };
}

export async function saveGeoapifyConfiguration(
  input: SaveGeoapifyConfigurationInput,
) {
  const baseUrl =
    normaliseBaseUrl(input.baseUrl);
  const dailyLimit =
    validateDailyLimit(input.dailyLimit);
  const apiKey = input.apiKey?.trim();

  const existing =
    await prisma.geoapifyApiConfiguration.findUnique({
      where: {
        provider: PROVIDER,
      },
    });

  if (!existing && !apiKey) {
    throw new Error(
      "An API key is required for initial configuration.",
    );
  }

  if (apiKey !== undefined && apiKey.length < 8) {
    throw new Error(
      "Geoapify API key is not valid.",
    );
  }

  const apiKeyData = apiKey
    ? {
        apiKeyEncrypted: encryptSecret(apiKey),
        apiKeyLastFour: apiKey.slice(-4),
      }
    : {};

  await prisma.geoapifyApiConfiguration.upsert({
    where: {
      provider: PROVIDER,
    },
    create: {
      provider: PROVIDER,
      baseUrl,
      isEnabled: input.isEnabled,
      dailyLimit,
      ...apiKeyData,
    },
    update: {
      baseUrl,
      isEnabled: input.isEnabled,
      dailyLimit,
      ...apiKeyData,
    },
  });

  return getPublicGeoapifyConfiguration();
}

export async function getStoredGeoapifyCredentials() {
  const configuration =
    await prisma.geoapifyApiConfiguration.findUnique({
      where: {
        provider: PROVIDER,
      },
    });

  if (
    !configuration ||
    !configuration.apiKeyEncrypted
  ) {
    throw new Error(
      "Geoapify credentials have not been saved.",
    );
  }

  return {
    baseUrl: configuration.baseUrl,
    apiKey: decryptSecret(
      configuration.apiKeyEncrypted,
    ),
    isEnabled: configuration.isEnabled,
    dailyLimit: configuration.dailyLimit,
  };
}

export async function getGeoapifyCredentials() {
  const credentials =
    await getStoredGeoapifyCredentials();

  if (!credentials.isEnabled) {
    throw new Error(
      "Geoapify integration is disabled.",
    );
  }

  return credentials;
}

export async function testGeoapifyConnection() {
  const credentials =
    await getStoredGeoapifyCredentials();

  const url = new URL(
    "/v1/geocode/reverse",
    `${credentials.baseUrl}/`,
  );

  url.search = new URLSearchParams({
    lat: "50.3755",
    lon: "-4.1427",
    format: "json",
    apiKey: credentials.apiKey,
  }).toString();

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    const payload =
      (await response.json()) as {
        results?: unknown[];
        message?: string;
        error?: string;
      };

    if (
      !response.ok ||
      !Array.isArray(payload.results)
    ) {
      throw new Error(
        payload.message ??
          payload.error ??
          `Geoapify returned HTTP ${response.status}.`,
      );
    }

    await prisma.geoapifyApiConfiguration.update({
      where: {
        provider: PROVIDER,
      },
      data: {
        lastTestedAt: new Date(),
        lastError: null,
      },
    });

    return {
      successful: true,
      resultCount: payload.results.length,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Geoapify connection test failed.";

    await prisma.geoapifyApiConfiguration.update({
      where: {
        provider: PROVIDER,
      },
      data: {
        lastTestedAt: new Date(),
        lastError: message.slice(0, 5000),
      },
    });

    throw new Error(message);
  }
}
