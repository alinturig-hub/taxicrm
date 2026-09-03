import { getServerSession } from "next-auth";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  ADMINISTRATION_PERMISSIONS,
  requireAdministrationPermission,
} from "@/lib/administration-access";
import {
  executeAnalyticsQuery,
  planAnalyticsQuestion,
} from "@/lib/ai/analytics-query-engine";
import {
  answerGeneralCopilotQuestion,
  refineCopilotAnswer,
} from "@/lib/ai/openclaw-copilot";
import { authOptions } from "@/lib/auth";
import { getLiveOperations } from "@/lib/operations/live-operations";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DAY_MS =
  24 * 60 * 60 * 1000;

type Intent =
  | "GENERAL_GUIDANCE"
  | "RESTRICTED"
  | "ANALYTICS"
  | "LIVE_OPERATIONS"
  | "DEMAND"
  | "WARNING"
  | "ACCURACY"
  | "AUTOMATION"
  | "HEALTH"
  | "PROVENANCE"
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
    /password|parolă|parola|secret|api key|token|credential|database dump|dump database|export database|phone numbers|telephone numbers|numere de telefon|customer addresses|adresele clienților|adresele clientilor|exact driver location|precise driver location|locația exactă|locatia exacta|coordinates|coordonate|run sql|execute sql|sql query|delete from|drop table|truncate|update database|modify database|șterge date|sterge date|shell command|bash command|execute command|contact customers|sună clienții|suna clientii/.test(
      normalized,
    )
  ) {
    return "RESTRICTED";
  }

  if (
    /is this real|are these real|what.*based on|basis|data source|source data|proof|evidence|date reale|sunt reale|este real|pe ce.*baz|dovad|provenien/.test(
      normalized,
    )
  ) {
    return "PROVENANCE";
  }

  if (
    /driver|drivers|online driver|on shift|live vehicle|vehicles|fleet|clear vehicle|busy vehicle|allocated|allocation|assigned job|job assigned|with passenger|passenger on board|passengers|\bpob\b|șofer|sofer|șoferi|soferi|în tură|in tura|vehicul|mașin|masin|flotă|flota|liberi|ocupat|job alocat|curse alocate|cu pasager/.test(
      normalized,
    )
  ) {
    return "LIVE_OPERATIONS";
  }

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
    /demand forecast|booking forecast|forecast|predicted bookings|expected bookings|cerere estimată|cerere estimata|prognoz|următoarele 24|urmatoarele 24|volum estimat/.test(
      normalized,
    )
  ) {
    return "DEMAND";
  }

  if (
    planAnalyticsQuestion(
      question,
    )
  ) {
    return "ANALYTICS";
  }

  return normalized.length > 0
    ? "GENERAL_GUIDANCE"
    : "HELP";
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

async function liveOperationsAnswer(
  question: string,
) {
  const operations =
    await getLiveOperations({
      pastMinutes: 60,
      futureMinutes: 120,
    });

  const normalized =
    question.trim().toLowerCase();

  const asksAboutAllocatedJobs =
    /allocated|allocation|assigned job|job assigned|with passenger|passenger on board|passengers|\bpob\b|job alocat|curse alocate|cu pasager/.test(
      normalized,
    );

  const allocatedActiveJobs =
    Math.max(
      0,
      operations.bookings.active -
        operations.bookings.withoutDriver,
    );

  if (asksAboutAllocatedJobs) {
    return {
      headline:
        `${allocatedActiveJobs.toLocaleString(
          "en-GB",
        )} active jobs have a driver allocated`,
      summary:
        `${operations.bookings.passengerOnBoard.toLocaleString(
          "en-GB",
        )} active jobs currently have a passenger on board. ${operations.bookings.withoutDriver.toLocaleString(
          "en-GB",
        )} active jobs do not currently have a driver assigned.`,
      metrics: [
        {
          label:
            "Active jobs",
          value:
            operations.bookings.active,
        },
        {
          label:
            "Driver allocated",
          value:
            allocatedActiveJobs,
        },
        {
          label:
            "Passenger on board",
          value:
            operations.bookings
              .passengerOnBoard,
        },
        {
          label:
            "Without driver",
          value:
            operations.bookings
              .withoutDriver,
        },
        {
          label:
            "Dispatched",
          value:
            operations.bookings
              .dispatched,
        },
        {
          label:
            "Accepted",
          value:
            operations.bookings
              .accepted,
        },
        {
          label:
            "Arrived",
          value:
            operations.bookings
              .arrived,
        },
      ],
      evidence: [
        "Driver allocated is calculated as active bookings minus active bookings without a driver.",
        "Passenger on board counts only bookings whose current TaxiCRM status is POB.",
        "Active booking statuses are CREATED, DISPATCHED, ACCEPTED, ARRIVED and POB.",
        "The live operational window covers the configured recent and upcoming interval.",
        "Only aggregate counts are supplied to the language model; customer, driver and location identities are excluded.",
      ],
      sources: [
        {
          label:
            "Live Operations",
          href:
            "/dashboard/live",
        },
      ],
    };
  }

  const driversOnShift =
    operations.drivers.onShift;
  const driversWithVehicle =
    operations.drivers.withVehicle;
  const driversWithoutVehicle =
    operations.drivers.withoutVehicle;
  const liveVehicles =
    operations.fleet.live;

  return {
    headline:
      `${driversOnShift.toLocaleString(
        "en-GB",
      )} drivers currently on shift`,
    summary:
      `${driversWithVehicle.toLocaleString(
        "en-GB",
      )} drivers have an assigned vehicle and ${driversWithoutVehicle.toLocaleString(
        "en-GB",
      )} do not. ${liveVehicles.toLocaleString(
        "en-GB",
      )} vehicles have reported during the last two minutes. Live vehicles and drivers on shift are separate measurements.`,
    metrics: [
      {
        label:
          "Drivers on shift",
        value:
          driversOnShift,
      },
      {
        label:
          "With vehicle",
        value:
          driversWithVehicle,
      },
      {
        label:
          "Without vehicle",
        value:
          driversWithoutVehicle,
      },
      {
        label:
          "Live vehicles (2 min)",
        value:
          liveVehicles,
      },
      {
        label:
          "Clear vehicles",
        value:
          operations.fleet.clear,
      },
      {
        label:
          "Busy vehicles",
        value:
          operations.fleet.busy,
      },
    ],
    evidence: [
      "Drivers on shift are unique drivers with an active DriverShift record.",
      "With vehicle means the active shift has an assigned vehicle.",
      "Live vehicles reported operational data during the last two minutes.",
      "A live vehicle count is not treated as a driver count.",
      "Only aggregate counts are provided to the language model; driver identities and locations are excluded.",
    ],
    sources: [
      {
        label:
          "Live Operations",
        href:
          "/dashboard/live",
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

function provenanceAnswer() {
  return {
    headline:
      "The displayed figures come from real TaxiCRM records",
    summary:
      "TaxiCRM calculates the answer from governed operational database records. The language model receives only the resulting aggregate metrics and explanations; it cannot change the figures, source links or stored evidence.",
    metrics: [],
    evidence: [
      "Operational figures are calculated by TaxiCRM before the language model is called.",
      "The language model receives aggregate evidence only.",
      "Metrics, evidence and source links remain controlled by TaxiCRM.",
      "If model output fails validation, the deterministic answer is used.",
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
          "System Health",
        href:
          "/dashboard/configuration/system-health",
      },
    ],
  };
}

function restrictedAnswer() {
  return {
    headline:
      "This request is restricted",
    summary:
      "Copilot cannot provide secrets, personal contact details, precise driver locations, unrestricted database access, SQL execution or instructions that modify TaxiCRM data. Use the authorized TaxiCRM workspace for permitted operational tasks.",
    metrics: [],
    evidence: [
      "The request was blocked before it reached the language model.",
      "No database query or external action was executed.",
      "No personal data, secret or precise location was disclosed.",
    ],
    sources: [],
    suggestions: [
      "How many drivers are online right now?",
      "What is today revenue?",
      "How many jobs have a passenger on board?",
      "Explain how completion rate is calculated",
    ],
  };
}

function helpAnswer() {
  return {
    headline:
      "Ask about measured TaxiCRM operations",
    summary:
      "I can explain revenue, booking volumes and outcomes, period comparisons, live drivers and fleet activity, demand forecasts, warnings, prediction accuracy, automation safety and system health.",
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
      "What is today revenue?",
      "How many bookings did we have yesterday?",
      "Compare revenue this week with last week",
      "How many drivers are online right now?",
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

    const analyticsPlan =
      intent === "ANALYTICS"
        ? planAnalyticsQuestion(
            question,
          )
        : null;

    if (
      analyticsPlan &&
      (
        analyticsPlan.metric ===
          "REVENUE" ||
        (
          analyticsPlan.metric ===
            "PERIOD_COMPARISON" &&
          analyticsPlan
            .comparisonMetric ===
            "REVENUE"
        )
      ) &&
      !access.isSuperAdmin &&
      !access.permissions.includes(
        ADMINISTRATION_PERMISSIONS
          .REVENUE_VIEW,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "REVENUE_PERMISSION_REQUIRED",
        },
        {
          status: 403,
        },
      );
    }

    if (
      analyticsPlan &&
      analyticsPlan.metric !==
        "REVENUE" &&
      !(
        analyticsPlan.metric ===
          "PERIOD_COMPARISON" &&
        analyticsPlan
          .comparisonMetric ===
          "REVENUE"
      ) &&
      !access.isSuperAdmin &&
      !access.permissions.includes(
        ADMINISTRATION_PERMISSIONS
          .BOOKINGS_VIEW,
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "BOOKINGS_PERMISSION_REQUIRED",
        },
        {
          status: 403,
        },
      );
    }

    const now =
      new Date();

    const groundedAnswer =
      analyticsPlan
        ? await executeAnalyticsQuery(
            analyticsPlan,
          )
        : intent ===
            "LIVE_OPERATIONS"
          ? await liveOperationsAnswer(
              question,
            )
        : intent === "DEMAND"
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
                : intent ===
                    "PROVENANCE"
                  ? provenanceAnswer()
                  : intent ===
                      "RESTRICTED"
                    ? restrictedAnswer()
                    : helpAnswer();

    const refinement =
      intent ===
        "GENERAL_GUIDANCE"
        ? await answerGeneralCopilotQuestion(
            question,
          )
        : intent ===
            "RESTRICTED"
          ? {
              answer:
                groundedAnswer,
              externalModelUsed:
                false,
              method:
                "POLICY_RESTRICTED_V1",
            }
          : await refineCopilotAnswer({
              question,
              intent,
              answer:
                groundedAnswer,
            });

    const answerType =
      intent ===
        "GENERAL_GUIDANCE"
        ? "GENERAL_GUIDANCE"
        : intent ===
            "RESTRICTED"
          ? "RESTRICTED"
          : "VERIFIED";

    return NextResponse.json({
      success: true,
      generatedAt: now,
      intent,
      answerType,
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
