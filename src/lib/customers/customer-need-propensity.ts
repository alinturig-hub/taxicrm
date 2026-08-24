type PredictionSignal = {
  status: "READY" | "LEARNING";
  needScore: number | null;
  confidence: number;
  predictedDay: string | null;
  predictedWindow: string | null;
  predictedStartAt: string | null;
};

type RhythmSignal = {
  status: "READY" | "LEARNING";
  rhythmType: string;
  regularityScore: number | null;
  scheduleStatus: string;
  overdueHours: number;
};

type ReturnSignal = {
  status: "READY" | "LEARNING";
  returnRate: number;
  confidence: number;
  typicalReturnLabel: string;
};

export type CustomerNeedPropensity = {
  status:
    | "READY"
    | "LEARNING"
    | "DISABLED";
  score: number | null;
  level:
    | "HIGH"
    | "ELEVATED"
    | "MODERATE"
    | "LOW"
    | "LEARNING"
    | "DISABLED";
  confidence: number;
  actionWindow:
    | "NOW"
    | "TODAY"
    | "UPCOMING"
    | "MONITOR"
    | "NONE";
  recommendedAction:
    | "REVIEW_SERVICE_READINESS"
    | "PREPARE_FOR_LIKELY_DEMAND"
    | "MONITOR_PATTERN"
    | "KEEP_LEARNING"
    | "NO_PERSONAL_ACTION";
  predictedStartAt: string | null;
  predictedDay: string | null;
  predictedWindow: string | null;
  components: {
    prediction: number;
    schedule: number;
    regularity: number;
    returnPattern: number;
  };
  signals: string[];
  explanation: string[];
};

function clamp(
  value: number,
  minimum: number,
  maximum: number,
) {
  return Math.min(
    maximum,
    Math.max(minimum, value),
  );
}

function level(
  score: number,
): CustomerNeedPropensity["level"] {
  if (score >= 75) {
    return "HIGH";
  }

  if (score >= 55) {
    return "ELEVATED";
  }

  if (score >= 35) {
    return "MODERATE";
  }

  return "LOW";
}

function actionWindow(
  score: number,
  scheduleStatus: string,
): CustomerNeedPropensity["actionWindow"] {
  if (
    score >= 75 &&
    (
      scheduleStatus === "DUE" ||
      scheduleStatus === "OVERDUE"
    )
  ) {
    return "NOW";
  }

  if (score >= 55) {
    return "TODAY";
  }

  if (score >= 35) {
    return "UPCOMING";
  }

  return "MONITOR";
}

function recommendedAction(
  score: number,
): CustomerNeedPropensity["recommendedAction"] {
  if (score >= 75) {
    return "REVIEW_SERVICE_READINESS";
  }

  if (score >= 55) {
    return "PREPARE_FOR_LIKELY_DEMAND";
  }

  return "MONITOR_PATTERN";
}

export function buildCustomerNeedPropensity({
  profileSafeForPersonalisation,
  prediction,
  rhythm,
  returnJourney,
}: {
  profileSafeForPersonalisation: boolean;
  prediction: PredictionSignal;
  rhythm: RhythmSignal;
  returnJourney: ReturnSignal;
}): CustomerNeedPropensity {
  if (!profileSafeForPersonalisation) {
    return {
      status: "DISABLED",
      score: null,
      level: "DISABLED",
      confidence: 0,
      actionWindow: "NONE",
      recommendedAction:
        "NO_PERSONAL_ACTION",
      predictedStartAt: null,
      predictedDay: null,
      predictedWindow: null,
      components: {
        prediction: 0,
        schedule: 0,
        regularity: 0,
        returnPattern: 0,
      },
      signals: [
        "Personal propensity is disabled for a shared or business booking profile.",
      ],
      explanation: [
        "The telephone number may represent multiple passengers.",
        "No personal action should be taken from combined behavioural signals.",
      ],
    };
  }

  if (
    prediction.status !== "READY" ||
    rhythm.status !== "READY"
  ) {
    return {
      status: "LEARNING",
      score: null,
      level: "LEARNING",
      confidence: Math.min(
        prediction.confidence,
        rhythm.regularityScore ?? 0,
      ),
      actionWindow: "NONE",
      recommendedAction:
        "KEEP_LEARNING",
      predictedStartAt:
        prediction.predictedStartAt,
      predictedDay:
        prediction.predictedDay,
      predictedWindow:
        prediction.predictedWindow,
      components: {
        prediction: 0,
        schedule: 0,
        regularity: 0,
        returnPattern: 0,
      },
      signals: [
        "More booking history is required before combining signals.",
      ],
      explanation: [
        "Prediction and rhythm must both be ready.",
        "No automatic customer contact should be triggered while the profile is learning.",
      ],
    };
  }

  const predictionComponent =
    clamp(
      (prediction.needScore ?? 0) * 0.55,
      0,
      55,
    );

  const scheduleComponent =
    rhythm.scheduleStatus === "OVERDUE"
      ? 25
      : rhythm.scheduleStatus === "DUE"
        ? 20
        : rhythm.scheduleStatus ===
            "ON_TRACK"
          ? 8
          : 0;

  const regularityComponent =
    clamp(
      (rhythm.regularityScore ?? 0) *
        0.1,
      0,
      10,
    );

  const returnComponent =
    returnJourney.status === "READY"
      ? clamp(
          returnJourney.returnRate *
            0.15,
          0,
          10,
        )
      : 0;

  const score = Math.round(
    clamp(
      predictionComponent +
        scheduleComponent +
        regularityComponent +
        returnComponent,
      0,
      100,
    ),
  );

  const confidenceWeights = [
    {
      value: prediction.confidence,
      weight: 0.5,
    },
    {
      value:
        rhythm.regularityScore ?? 0,
      weight: 0.3,
    },
    ...(returnJourney.status === "READY"
      ? [
          {
            value:
              returnJourney.confidence,
            weight: 0.2,
          },
        ]
      : []),
  ];

  const totalWeight =
    confidenceWeights.reduce(
      (total, item) =>
        total + item.weight,
      0,
    );

  const confidence = Math.round(
    confidenceWeights.reduce(
      (total, item) =>
        total +
        item.value * item.weight,
      0,
    ) / totalWeight,
  );

  const signals = [
    `Next-booking model contributes ${Math.round(predictionComponent)} of 55 points.`,
    `Schedule status is ${rhythm.scheduleStatus.toLowerCase().replace("_", " ")}.`,
    `Booking rhythm is ${rhythm.rhythmType.toLowerCase().replace("_", " ")}.`,
  ];

  if (returnJourney.status === "READY") {
    signals.push(
      `${returnJourney.returnRate}% of eligible historical journeys were followed by a return within 24 hours.`,
    );
  }

  if (
    rhythm.scheduleStatus === "OVERDUE"
  ) {
    signals.push(
      `The observed rhythm is overdue by ${rhythm.overdueHours} hours.`,
    );
  }

  return {
    status: "READY",
    score,
    level: level(score),
    confidence,
    actionWindow: actionWindow(
      score,
      rhythm.scheduleStatus,
    ),
    recommendedAction:
      recommendedAction(score),
    predictedStartAt:
      prediction.predictedStartAt,
    predictedDay:
      prediction.predictedDay,
    predictedWindow:
      prediction.predictedWindow,
    components: {
      prediction: Math.round(
        predictionComponent,
      ),
      schedule: scheduleComponent,
      regularity: Math.round(
        regularityComponent,
      ),
      returnPattern: Math.round(
        returnComponent,
      ),
    },
    signals,
    explanation: [
      "This is an internal operational propensity score, not proof that the customer currently needs a taxi.",
      "The score does not use protected locations, medical information, financial eligibility or inferred personal traits.",
      "Use it to review service readiness. Customer contact still requires an appropriate lawful basis and communication preference.",
    ],
  };
}
