type GroundedCopilotAnswer = {
  headline: string;
  summary: string;
  metrics: Array<{
    label: string;
    value: number;
    suffix?: string;
  }>;
  evidence: string[];
  sources: Array<{
    label: string;
    href: string;
  }>;
  suggestions?: string[];
};

type RefinementResult = {
  answer: GroundedCopilotAnswer;
  externalModelUsed: boolean;
  method:
    | "OPENCLAW_GROUNDED_V1"
    | "DETERMINISTIC_EVIDENCE_V1";
};

function requestedLanguage(
  question: string,
) {
  return (
    /[ăâîșț]/i.test(
      question,
    ) ||
    /\b(câte|cate|de ce|avem|următoarele|urmatoarele|dovezi|bazat|bazează|bazeaza|date reale|este real|sunt reale)\b/i.test(
      question,
    )
  )
    ? "Romanian"
    : "English";
}

function containsUnsupportedScript(
  value: string,
) {
  return /[\u3400-\u9fff\u0400-\u04ff\u0600-\u06ff]/.test(
    value,
  );
}

function numericFingerprints(
  value: string,
) {
  return new Set(
    (
      value.match(
        /\d+(?:[.,]\d+)*/g,
      ) ?? []
    ).map(
      (number) =>
        number.replace(
          /\D/g,
          "",
        ),
    ),
  );
}

function validRefinement(
  value: unknown,
  groundedText: string,
): value is {
  headline: string;
  summary: string;
} {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false;
  }

  const candidate =
    value as Record<
      string,
      unknown
    >;

  if (
    typeof candidate.headline !==
      "string" ||
    typeof candidate.summary !==
      "string" ||
    candidate.headline.length < 1 ||
    candidate.headline.length > 180 ||
    candidate.summary.length < 1 ||
    candidate.summary.length > 900
  ) {
    return false;
  }

  if (
    containsUnsupportedScript(
      [
        candidate.headline,
        candidate.summary,
      ].join(" "),
    )
  ) {
    return false;
  }

  const allowedNumbers =
    numericFingerprints(
      groundedText,
    );

  const generatedNumbers =
    numericFingerprints(
      [
        candidate.headline,
        candidate.summary,
      ].join(" "),
    );

  return Array.from(
    generatedNumbers,
  ).every(
    (number) =>
      allowedNumbers.has(number),
  );
}

function parseJsonObject(
  content: string,
) {
  const start =
    content.indexOf("{");
  const end =
    content.lastIndexOf("}");

  if (
    start < 0 ||
    end <= start
  ) {
    return null;
  }

  try {
    return JSON.parse(
      content.slice(
        start,
        end + 1,
      ),
    ) as unknown;
  } catch {
    return null;
  }
}

export async function refineCopilotAnswer({
  question,
  intent,
  answer,
}: {
  question: string;
  intent: string;
  answer: GroundedCopilotAnswer;
}): Promise<RefinementResult> {
  const baseUrl =
    process.env
      .OPENCLAW_COPILOT_BASE_URL
      ?.trim()
      .replace(/\/+$/, "");

  const token =
    process.env
      .OPENCLAW_COPILOT_TOKEN
      ?.trim();

  const model =
    process.env
      .OPENCLAW_COPILOT_MODEL
      ?.trim() ||
    "openclaw/taxicrm-copilot";

  if (
    !baseUrl ||
    !token
  ) {
    return {
      answer,
      externalModelUsed: false,
      method:
        "DETERMINISTIC_EVIDENCE_V1",
    };
  }

  const language =
    requestedLanguage(
      question,
    );

  const groundedText =
    JSON.stringify({
      intent,
      answer,
    });

  try {
    const response =
      await fetch(
        `${baseUrl}/v1/chat/completions`,
        {
          method: "POST",
          headers: {
            authorization:
              `Bearer ${token}`,
            "content-type":
              "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "system",
                content:
                  `You are TaxiCRM Copilot. Rewrite only the supplied grounded headline and summary. You MUST answer in ${language} only. Do not use Chinese, Cyrillic or Arabic scripts. Do not add facts, numbers, names, predictions, advice or assumptions. Never claim database, filesystem, terminal or external-system access. Return JSON only with exactly two string fields: headline and summary.`,
              },
              {
                role: "user",
                content:
                  JSON.stringify({
                    question,
                    governedEvidence: {
                      intent,
                      headline:
                        answer.headline,
                      summary:
                        answer.summary,
                      metrics:
                        answer.metrics,
                      evidence:
                        answer.evidence,
                    },
                  }),
              },
            ],
            temperature: 0,
            max_completion_tokens:
              350,
          }),
          signal:
            AbortSignal.timeout(
              12000,
            ),
        },
      );

    if (!response.ok) {
      throw new Error(
        `OpenClaw returned ${response.status}.`,
      );
    }

    const payload =
      await response.json() as {
        choices?: Array<{
          message?: {
            content?: unknown;
            tool_calls?: unknown[];
          };
        }>;
      };

    const message =
      payload.choices?.[0]
        ?.message;

    if (
      !message ||
      typeof message.content !==
        "string" ||
      (
        message.tool_calls
          ?.length ?? 0
      ) > 0
    ) {
      throw new Error(
        "OpenClaw returned an invalid response.",
      );
    }

    const refinement =
      parseJsonObject(
        message.content,
      );

    if (
      !validRefinement(
        refinement,
        groundedText,
      )
    ) {
      throw new Error(
        "OpenClaw response failed grounding validation.",
      );
    }

    return {
      answer: {
        ...answer,
        headline:
          refinement.headline,
        summary:
          refinement.summary,
      },
      externalModelUsed: true,
      method:
        "OPENCLAW_GROUNDED_V1",
    };
  } catch (error) {
    console.warn(
      "OpenClaw Copilot fallback:",
      error instanceof Error
        ? error.message
        : "Unknown model error.",
    );

    return {
      answer,
      externalModelUsed: false,
      method:
        "DETERMINISTIC_EVIDENCE_V1",
    };
  }
}

type GeneralCopilotResult = {
  answer: GroundedCopilotAnswer;
  externalModelUsed: boolean;
  method:
    | "OPENCLAW_GENERAL_V1"
    | "GENERAL_GUIDANCE_FALLBACK_V1";
};

function validGeneralAnswer(
  value: unknown,
): value is {
  headline: string;
  summary: string;
} {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false;
  }

  const candidate =
    value as Record<
      string,
      unknown
    >;

  return (
    typeof candidate.headline ===
      "string" &&
    candidate.headline.length >= 1 &&
    candidate.headline.length <= 180 &&
    typeof candidate.summary ===
      "string" &&
    candidate.summary.length >= 1 &&
    candidate.summary.length <= 1200 &&
    !containsUnsupportedScript(
      candidate.headline +
        " " +
        candidate.summary,
    )
  );
}

export async function answerGeneralCopilotQuestion(
  question: string,
): Promise<GeneralCopilotResult> {
  const fallbackAnswer: GroundedCopilotAnswer = {
    headline:
      "General guidance is temporarily unavailable",
    summary:
      "I can still answer verified questions about TaxiCRM revenue, bookings, live operations, forecasts, warnings and system health.",
    metrics: [],
    evidence: [
      "No operational database result was used for this answer.",
      "The general language model was unavailable, so no unverified answer was generated.",
    ],
    sources: [],
    suggestions: [
      "What is today revenue?",
      "How many drivers are online right now?",
      "How many bookings are expected in the next 24 hours?",
    ],
  };

  const baseUrl =
    process.env
      .OPENCLAW_COPILOT_BASE_URL
      ?.trim()
      .replace(/\/+$/, "");

  const token =
    process.env
      .OPENCLAW_COPILOT_TOKEN
      ?.trim();

  const model =
    process.env
      .OPENCLAW_COPILOT_MODEL
      ?.trim() ||
    "openclaw/taxicrm-copilot";

  if (!baseUrl || !token) {
    return {
      answer:
        fallbackAnswer,
      externalModelUsed:
        false,
      method:
        "GENERAL_GUIDANCE_FALLBACK_V1",
    };
  }

  const language =
    requestedLanguage(
      question,
    );

  try {
    const response =
      await fetch(
        `${baseUrl}/v1/chat/completions`,
        {
          method: "POST",
          headers: {
            authorization:
              `Bearer ${token}`,
            "content-type":
              "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "system",
                content:
                  `You are TaxiCRM Copilot providing GENERAL GUIDANCE, not a verified operational answer. Answer in ${language} only. Do not use Chinese, Cyrillic or Arabic scripts. Be concise and useful. You have no database, filesystem, terminal, browser or external-system access. Never claim to know current TaxiCRM figures unless governed evidence was supplied; none is supplied here. Never invent customer, driver, booking, revenue or fleet data. Never reveal or request passwords, tokens, API keys, personal contact details, addresses or precise locations. Never provide instructions to bypass authorization, execute SQL, modify data, run shell commands, contact customers or trigger operational actions. Clearly state when a question requires live TaxiCRM evidence. Return JSON only with exactly two string fields: headline and summary.`,
              },
              {
                role: "user",
                content:
                  JSON.stringify({
                    question,
                    answerType:
                      "GENERAL_GUIDANCE",
                  }),
              },
            ],
            temperature: 0.2,
            max_completion_tokens:
              500,
          }),
          signal:
            AbortSignal.timeout(
              12000,
            ),
        },
      );

    if (!response.ok) {
      throw new Error(
        `OpenClaw returned ${response.status}.`,
      );
    }

    const payload =
      await response.json() as {
        choices?: Array<{
          message?: {
            content?: unknown;
            tool_calls?: unknown[];
          };
        }>;
      };

    const message =
      payload.choices?.[0]
        ?.message;

    if (
      !message ||
      typeof message.content !==
        "string" ||
      (
        message.tool_calls
          ?.length ?? 0
      ) > 0
    ) {
      throw new Error(
        "OpenClaw returned an invalid general response.",
      );
    }

    const generated =
      parseJsonObject(
        message.content,
      );

    if (
      !validGeneralAnswer(
        generated,
      )
    ) {
      throw new Error(
        "OpenClaw general response failed validation.",
      );
    }

    return {
      answer: {
        headline:
          generated.headline,
        summary:
          generated.summary,
        metrics: [],
        evidence: [
          "This is general guidance generated by the language model.",
          "No live TaxiCRM records or operational metrics were used.",
          "The answer cannot modify data or trigger operational actions.",
        ],
        sources: [],
      },
      externalModelUsed:
        true,
      method:
        "OPENCLAW_GENERAL_V1",
    };
  } catch (error) {
    console.warn(
      "OpenClaw general Copilot fallback:",
      error instanceof Error
        ? error.message
        : "Unknown model error.",
    );

    return {
      answer:
        fallbackAnswer,
      externalModelUsed:
        false,
      method:
        "GENERAL_GUIDANCE_FALLBACK_V1",
    };
  }
}
