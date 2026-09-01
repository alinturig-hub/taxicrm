import { getServerSession } from "next-auth";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  ADMINISTRATION_PERMISSIONS,
  requireAdministrationPermission,
} from "@/lib/administration-access";
import { refineCopilotAnswer } from "@/lib/ai/openclaw-copilot";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DAY_MS =
  24 * 60 * 60 * 1000;

type Intent =
  | "DEMAND"
  | "WARNING"
  | "ACCURACY"
  | "AUTOMATION"
  | "HEALTH"
  | "HELP";

function percentage(
  value: number,
  total: number,
) {
  return total > 0
    ? Number(
        (
          100 *
          value /
          total
        ).toFixed(1),
      )
    : null;
}

function classify(
  question: string,
): Intent {
  const normalized =
    question
      .trim()
      .toLowerCase();

  if (
    /warning|alert|exception|eroare|avert|problem|outside range|overestimate|supraestimat/.test(
      normalized,
    )
  ) {
    return "WARNING";
  }

  if (
    /accuracy|accurate|precizie|corect|hit rate|slot|nimerit/.test(
      normalized,
    )
  ) {
    return "ACCURACY";
  }

  if (
    /automation|automatizare|cron|simulation|simulare|rule|regul/.test(
      normalized,
    )
  ) {
    return "AUTOMATION";
  }

  if (
    /health|healthy|system|sănătate|sanatate|job run|rulează|ruleaza/.test(
      normalized,
    )
  ) {
    return "HEALTH";
  }

  if (
    /demand|forecast|booking|bookings|cerere|următoarele 24|urmatoarele 24|volum|estimate/.test(
      normalized,
    )
  ) {
    return "DEMAND";
  }

  return "HELP";
}

function evidenceObject(
  value: unknown,
): Record<string, unknown> {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
      ? value as Record<
          string,
          unknown
        >
      : {};
}

function numberEvidence(
  evidence: Record<
    string,
    unknown
  >,
  key: string,
) {
  return typeof evidence[key] ===
    "number"
      ? evidence[key] as number
      : null;
}

async function demandAnswer(
  now: Date,
) {
  const forecast =
    await prisma.bookingDemandForecast.findFirst({
      where: {
        modelVersion:
          "BOOKING_DEMAND_V1",
        targetType:
          "BOOKING_REQUESTS",
        status: "PENDING",
        windowEndAt: {
          gt: now,
        },
      },
      orderBy: {
        issuedAt: "desc",
      },
      select: {
        id: true,
        predictedCount: true,
        lowerBound: true,
        upperBound: true,
        windowStartAt: true,
        windowEndAt: true,
      },
    });

  if (!forecast) {
    return {
      headline:
        "No active booking-demand forecast",
      summary:
        "The system does not currently have a pending 24-hour demand forecast.",
      metrics: [],
      evidence: [
        "No active BOOKING_DEMAND_V1 record was found.",
      ],
      sources: [
        {
          label:
            "System Health",
          href:
            "/dashboard/configuration/system-health",
        },
      ],
    };
  }

  const observed =
    await prisma.booking.count({
      where: {
        bookedAtTime: {
          gte:
            forecast.windowStartAt,
          lt: new Date(
            Math.min(
              now.getTime(),
              forecast.windowEndAt
                .getTime(),
            ),
          ),
        },
      },
    });

  const elapsedPercent =
    Math.min(
      100,
      Math.max(
        0,
        Number(
          (
            100 *
            (
              now.getTime() -
              forecast
                .windowStartAt
                .getTime()
            ) /
            (
              forecast
                .windowEndAt
                .getTime() -
              forecast
                .windowStartAt
                .getTime()
            )
          ).toFixed(1),
        ),
      ),
    );

  return {
    headline:
      `${forecast.predictedCount.toLocaleString(
        "en-GB",
      )} booking requests expected`,
    summary:
      `The active 24-hour forecast expects between ${forecast.lowerBound.toLocaleString(
        "en-GB",
      )} and ${forecast.upperBound.toLocaleString(
        "en-GB",
      )} unique booking requests. ${observed.toLocaleString(
        "en-GB",
      )} have been observed so far, with ${elapsedPercent}% of the window elapsed.`,
    metrics: [
      {
        label: "Estimated",
        value:
          forecast.predictedCount,
      },
      {
        label: "Lower bound",
        value:
          forecast.lowerBound,
      },
      {
        label: "Upper bound",
        value:
          forecast.upperBound,
      },
      {
        label: "Observed so far",
        value: observed,
      },
    ],
    evidence: [
      "Counts use unique Booking rows inside the active forecast window.",
      "Observed-so-far is not treated as the final outcome before the window expires.",
    ],
    sources: [
      {
        label:
          "AI Predictions",
        href:
          "/dashboard/ai/predictions",
      },
      {
        label:
          "AI Insights",
        href:
          "/dashboard/ai/insights",
      },
    ],
  };
}

async function warningAnswer() {
  const alert =
    await prisma.bookingDemandAlert.findFirst({
      where: {
        status: "OPEN",
      },
      orderBy: [
        {
          severity: "asc",
        },
        {
          lastSeenAt: "desc",
        },
      ],
      select: {
        type: true,
        severity: true,
        message: true,
        evidence: true,
        lastSeenAt: true,
      },
    });

  if (!alert) {
    return {
      headline:
        "No active forecast warning",
      summary:
        "The latest checks found no open booking-demand exception.",
      metrics: [],
      evidence: [
        "Open BookingDemandAlert count is zero.",
      ],
      sources: [
        {
          label:
            "AI Insights",
          href:
            "/dashboard/ai/insights",
        },
      ],
    };
  }

  const evidence =
    evidenceObject(
      alert.evidence,
    );

  const predicted =
    numberEvidence(
      evidence,
      "predictedCount",
    );
  const actual =
    numberEvidence(
      evidence,
      "actualCount",
    );
  const difference =
    numberEvidence(
      evidence,
      "difference",
    );
  const error =
    numberEvidence(
      evidence,
      "percentageError",
    );

  return {
    headline:
      alert.type ===
      "FORECAST_ACCURACY_WARNING"
        ? "The latest verified forecast requires attention"
        : alert.type.replaceAll(
            "_",
            " ",
          ),
    summary:
      alert.message,
    metrics: [
      ...(predicted === null
        ? []
        : [
            {
              label: "Estimated",
              value: predicted,
            },
          ]),
      ...(actual === null
        ? []
        : [
            {
              label: "Actual",
              value: actual,
            },
          ]),
      ...(difference === null
        ? []
        : [
            {
              label: "Difference",
              value:
                difference,
            },
          ]),
      ...(error === null
        ? []
        : [
            {
              label: "Error percent",
              value: error,
              suffix: "%",
            },
          ]),
    ],
    evidence: [
      `Severity: ${alert.severity}.`,
      "The warning is based on a completed live forecast, not an unfinished window.",
      "Historical warnings are retained separately as resolved audit evidence.",
    ],
    sources: [
      {
        label:
          "AI Insights",
        href:
          "/dashboard/ai/insights",
      },
      {
        label:
          "System Health",
        href:
          "/dashboard/configuration/system-health",
      },
    ],
  };
}

async function accuracyAnswer(
  now: Date,
) {
  const periodStart =
    new Date(
      now.getTime() -
        14 * DAY_MS,
    );

  const outcomes =
    await prisma.customerBookingPrediction.findMany({
      where: {
        modelVersion:
          "HAZARD_SLOT_V1",
        horizonHours: 24,
        issuedAt: {
          gte: periodStart,
        },
        status: {
          in: [
            "HIT",
            "MISSED",
          ],
        },
      },
      select: {
        status: true,
        likelyWindowStartAt: true,
        likelyWindowEndAt: true,
        likelyWindowHit: true,
      },
    });

  const hits =
    outcomes.filter(
      (outcome) =>
        outcome.status === "HIT",
    );

  const slotEvaluated =
    outcomes.filter(
      (outcome) =>
        outcome
          .likelyWindowStartAt !==
          null &&
        outcome
          .likelyWindowEndAt !==
          null,
    );

  const slotHits =
    slotEvaluated.filter(
      (outcome) =>
        outcome.status === "HIT" &&
        outcome
          .likelyWindowHit === true,
    );

  const hitRate =
    percentage(
      hits.length,
      outcomes.length,
    );

  const slotHitRate =
    percentage(
      slotHits.length,
      slotEvaluated.length,
    );

  return {
    headline:
      hitRate === null
        ? "Prediction accuracy is still learning"
        : `${hitRate}% 24-hour prediction accuracy`,
    summary:
      `${outcomes.length.toLocaleString(
        "en-GB",
      )} customer predictions were evaluated over the last 14 days. The three-hour interval accuracy is ${
        slotHitRate === null
          ? "still learning"
          : `${slotHitRate}%`
      }.`,
    metrics: [
      {
        label:
          "Evaluated",
        value:
          outcomes.length,
      },
      {
        label:
          "24-hour hits",
        value:
          hits.length,
      },
      ...(hitRate === null
        ? []
        : [
            {
              label:
                "24-hour accuracy",
              value:
                hitRate,
              suffix: "%",
            },
          ]),
      ...(slotHitRate === null
        ? []
        : [
            {
              label:
                "Three-hour accuracy",
              value:
                slotHitRate,
              suffix: "%",
            },
          ]),
    ],
    evidence: [
      "A HIT requires an observed booking inside the prediction horizon.",
      "Three-hour accuracy is measured separately from the 24-hour outcome.",
      "Customer-level signals are not added together to estimate total booking demand.",
    ],
    sources: [
      {
        label:
          "AI Predictions",
        href:
          "/dashboard/ai/predictions",
      },
      {
        label:
          "AI Insights",
        href:
          "/dashboard/ai/insights",
      },
    ],
  };
}

async function automationAnswer() {
  const [
    rules,
    simulations,
  ] = await Promise.all([
    prisma.automationRule.findMany({
      select: {
        status: true,
        mode: true,
      },
    }),
    prisma.automationExecution.count({
      where: {
        mode: "SIMULATION",
      },
    }),
  ]);

  const enabled =
    rules.filter(
      (rule) =>
        rule.status !==
        "DISABLED",
    ).length;

  return {
    headline:
      "Automation remains simulation-only",
    summary:
      `${rules.length} controlled rules are registered. ${enabled} are enabled and ${simulations} simulations have been recorded. Existing server cron jobs remain independent.`,
    metrics: [
      {
        label: "Rules",
        value: rules.length,
      },
      {
        label:
          "Enabled rules",
        value: enabled,
      },
      {
        label:
          "Simulations",
        value: simulations,
      },
      {
        label:
          "Direct executions",
        value: 0,
      },
    ],
    evidence: [
      "The Automation UI does not expose production execution.",
      "Simulations process zero records and execute zero external actions.",
      "Customer contact is disabled.",
    ],
    sources: [
      {
        label:
          "AI Automation",
        href:
          "/dashboard/ai/automation",
      },
    ],
  };
}

async function healthAnswer() {
  const jobKeys = [
    "CUSTOMER_BOOKING_PREDICTIONS",
    "BOOKING_DEMAND_FORECAST",
    "CUSTOMER_PROFILE_SNAPSHOTS",
    "HISTORICAL_GEOAPIFY_BACKFILL",
  ];

  const runs =
    await prisma.customerIntelligenceJobRun.findMany({
      where: {
        jobKey: {
          in: jobKeys,
        },
      },
      orderBy: {
        startedAt: "desc",
      },
      take: 100,
      select: {
        jobKey: true,
        status: true,
        startedAt: true,
        failed: true,
      },
    });

  const latest =
    jobKeys.map(
      (jobKey) =>
        runs.find(
          (run) =>
            run.jobKey ===
            jobKey,
        ) ?? null,
    );

  const healthy =
    latest.filter(
      (run) =>
        run?.status ===
          "SUCCEEDED" &&
        run.failed === 0,
    ).length;

  const missing =
    latest.filter(
      (run) =>
        run === null,
    ).length;

  return {
    headline:
      `${healthy} of ${jobKeys.length} monitored jobs healthy`,
    summary:
      missing > 0
        ? `${missing} monitored job${
            missing === 1
              ? " has"
              : "s have"
          } no recorded execution.`
        : "Every monitored job has a recorded execution. Review System Health for schedule freshness and detailed history.",
    metrics: [
      {
        label:
          "Monitored jobs",
        value:
          jobKeys.length,
      },
      {
        label:
          "Latest runs healthy",
        value: healthy,
      },
      {
        label:
          "Missing runs",
        value: missing,
      },
    ],
    evidence: [
      "Health uses the latest immutable job-run entry for each monitored process.",
      "Schedule freshness remains governed by System Health thresholds.",
    ],
    sources: [
      {
        label:
          "System Health",
        href:
          "/dashboard/configuration/system-health",
      },
      {
        label:
          "AI Automation",
        href:
          "/dashboard/ai/automation",
      },
    ],
  };
}

function helpAnswer() {
  return {
    headline:
      "Ask about measured TaxiCRM operations",
    summary:
      "I can explain booking demand, active warnings, prediction accuracy, automation safety and system health.",
    metrics: [],
    evidence: [
      "Answers are assembled from governed TaxiCRM records.",
      "Language generation cannot change governed metrics, evidence or source links.",
    ],
    sources: [
      {
        label:
          "AI Insights",
        href:
          "/dashboard/ai/insights",
      },
      {
        label:
          "AI Predictions",
        href:
          "/dashboard/ai/predictions",
      },
      {
        label:
          "AI Automation",
        href:
          "/dashboard/ai/automation",
      },
    ],
    suggestions: [
      "How many bookings are expected in the next 24 hours?",
      "Why is there a forecast warning?",
      "How accurate are customer predictions?",
      "Is automation executing real actions?",
      "Are the intelligence jobs healthy?",
    ],
  };
}

export async function POST(
  request: NextRequest,
) {
  const session =
    await getServerSession(authOptions);

  const access =
    await requireAdministrationPermission(
      session?.user?.email,
      ADMINISTRATION_PERMISSIONS
        .INTELLIGENCE_VIEW,
    );

  if (!access) {
    return NextResponse.json(
      {
        success: false,
        error: "FORBIDDEN",
      },
      {
        status: 403,
      },
    );
  }

  try {
    const body =
      (await request.json().catch(
        () => ({}),
      )) as {
        question?: unknown;
      };

    const question =
      typeof body.question === "string"
        ? body.question
            .trim()
            .slice(0, 500)
        : "";

    const intent =
      classify(question);

    const now =
      new Date();

    const groundedAnswer =
      intent === "DEMAND"
        ? await demandAnswer(now)
        : intent === "WARNING"
          ? await warningAnswer()
          : intent === "ACCURACY"
            ? await accuracyAnswer(
                now,
              )
            : intent ===
                "AUTOMATION"
              ? await automationAnswer()
              : intent ===
                  "HEALTH"
                ? await healthAnswer()
                : helpAnswer();

    const refinement =
      await refineCopilotAnswer({
        question,
        intent,
        answer:
          groundedAnswer,
      });

    return NextResponse.json({
      success: true,
      generatedAt: now,
      intent,
      method:
        refinement.method,
      answer:
        refinement.answer,
      safeguards: {
        externalModelUsed:
          refinement.externalModelUsed,
        questionStored: false,
        writeActionsEnabled: false,
        customerContactEnabled: false,
      },
      privacy: {
        aggregateOnly: true,
        containsPersonalData: false,
        containsCustomerIdentity: false,
        containsContactDetails: false,
        containsRoutes: false,
        containsProtectedPlaces: false,
      },
    });
  } catch (error) {
    console.error(
      "Evidence Copilot failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "EVIDENCE_COPILOT_FAILED",
        message:
          "Copilot could not build a verified answer.",
      },
      {
        status: 500,
      },
    );
  }
}
