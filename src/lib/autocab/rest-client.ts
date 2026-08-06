export type AutocabDriverSummary = {
  id: number;
  callsign?: string | null;
  fullName?: string | null;
  active?: boolean;
  suspended?: boolean;
};

type AutocabRequestOptions = {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
};

export class AutocabRestError extends Error {
  status: number | null;
  responseBody: string | null;

  constructor(
    message: string,
    options?: {
      status?: number | null;
      responseBody?: string | null;
    },
  ) {
    super(message);
    this.name = "AutocabRestError";
    this.status = options?.status ?? null;
    this.responseBody = options?.responseBody ?? null;
  }
}

function normaliseBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

export async function getAutocabDrivers({
  baseUrl,
  apiKey,
  timeoutMs = 15000,
}: AutocabRequestOptions): Promise<AutocabDriverSummary[]> {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(
      `${normaliseBaseUrl(baseUrl)}/driver/v1/drivers`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Ocp-Apim-Subscription-Key": apiKey,
        },
        cache: "no-store",
        signal: controller.signal,
      },
    );

    const responseText = await response.text();

    if (!response.ok) {
      throw new AutocabRestError(
        `Autocab returned HTTP ${response.status}.`,
        {
          status: response.status,
          responseBody: responseText.slice(0, 1000),
        },
      );
    }

    let payload: unknown;

    try {
      payload = JSON.parse(responseText);
    } catch {
      throw new AutocabRestError(
        "Autocab returned invalid JSON.",
        {
          status: response.status,
          responseBody: responseText.slice(0, 1000),
        },
      );
    }

    if (!Array.isArray(payload)) {
      throw new AutocabRestError(
        "Autocab drivers response is not an array.",
        {
          status: response.status,
        },
      );
    }

    return payload as AutocabDriverSummary[];
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "AbortError"
    ) {
      throw new AutocabRestError(
        `Autocab request timed out after ${timeoutMs}ms.`,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
