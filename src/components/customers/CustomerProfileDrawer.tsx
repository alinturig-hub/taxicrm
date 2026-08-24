"use client";

import {
  useEffect,
  useState,
} from "react";

type RankedValue = {
  label: string;
  count: number;
  percentage: number;
};

type ProfileResponse = {
  success: boolean;
  message?: string;
  customer?: {
    id: string;
    name: string | null;
    telephoneNumber: string;
    email: string | null;
    firstBookingAt: string | null;
    lastBookingAt: string | null;
  };
  profile?: {
    overview: {
      totalBookings: number;
      completed: number;
      cancelled: number;
      noFare: number;
      rejected: number;
      completionRate: number;
      cancellationRate: number;
      noFareRate: number;
      totalSpent: number;
      averageCompletedValue: number;
      firstBookingAt: string | null;
      lastBookingAt: string | null;
      daysSinceLastBooking: number | null;
      medianGapDays: number;
    };
    classification: {
      lifecycle: string;
      identityType: string;
      identityConfidence: number;
      profileSafeForPersonalisation: boolean;
    };
    behaviour: {
      days: RankedValue[];
      hours: RankedValue[];
      paymentMethods: RankedValue[];
      bookingChannels: RankedValue[];
    };
    places: {
      topPickups: RankedValue[];
      topDestinations: RankedValue[];
      uniqueDestinations: number;
    };
    insights: Array<{
      type: "FACT" | "INFERENCE";
      title: string;
      detail: string;
      confidence: number;
    }>;
    opportunities: Array<{
      action: string;
      reason: string;
      priority: "LOW" | "MEDIUM" | "HIGH";
    }>;
    latestBookings: Array<{
      externalId: string;
      status: string;
      bookedAtTime: string | null;
      pickupDueTime: string | null;
      price: number | string | null;
      paymentType: string | null;
      locations: Array<{
        type: "PICKUP" | "DESTINATION";
        address: string;
        zoneName: string | null;
      }>;
    }>;
  };
  profileDataQuality?: {
    score: number;
    grade:
      | "EXCELLENT"
      | "GOOD"
      | "FAIR"
      | "LIMITED";
    totalBookings: number;
    readyForBehaviourAnalysis: boolean;
    readyForPrediction: boolean;
    readyForPlaceInsights: boolean;
    coverage: {
      time: number;
      status: number;
      price: number;
      zones: number;
      weather: number;
      enrichedPlaces: number;
    };
    components: {
      historyDepth: number;
      time: number;
      status: number;
      price: number;
      zones: number;
      weather: number;
      enrichedPlaces: number;
    };
    protectedJourneys: number;
    strengths: string[];
    limitations: string[];
    explanation: string[];
  };
  placeIntelligence?: {
    matchedLocations: number;
    distinctPlaces: number;
    protectedPlaces: number;
    places: Array<{
      id: string;
      name: string | null;
      formattedAddress: string | null;
      category: string | null;
      website: string | null;
      confidence: number | null;
      isSensitive: boolean;
      linkedBookings: number;
      bookingIds: string[];
      pickupMatches: number;
      destinationMatches: number;
    }>;
  };
  returnJourney?: {
    status: "READY" | "LEARNING";
    analysedJourneys: number;
    excludedSensitiveJourneys: number;
    returnPairs: number;
    returnRate: number;
    typicalReturnHours: number | null;
    typicalReturnLabel: string;
    returnWindow:
      | "QUICK_RETURN"
      | "SAME_PART_OF_DAY"
      | "LATER_SAME_DAY"
      | "NEXT_DAY"
      | "LEARNING";
    confidence: number;
    strongestRoutes: Array<{
      pickupZone: string;
      destinationZone: string;
      returnPairs: number;
      sharePercent: number;
      typicalReturnHours: number;
    }>;
    explanation: string[];
  };
  contextualIntelligence?: {
    status: "READY" | "LEARNING";
    analysedBookings: number;
    availableEvents: number;
    matchedBookings: number;
    matchedBookingPercentage: number;
    eventHours: number;
    normalHours: number;
    eventBookingsPer100Hours: number | null;
    normalBookingsPer100Hours: number | null;
    liftPercent: number | null;
    tendency:
      | "MORE_ACTIVE_DURING_EVENTS"
      | "LESS_ACTIVE_DURING_EVENTS"
      | "NO_CLEAR_DIFFERENCE"
      | "LEARNING";
    confidence: number;
    categories: Array<{
      category: string;
      bookings: number;
      events: number;
      percentage: number;
    }>;
    strongestAssociations: Array<{
      eventId: string;
      title: string;
      category: string;
      startsAt: string;
      endsAt: string;
      locationName: string | null;
      impactLevel: string;
      source: string;
      bookings: number;
      bookingIds: string[];
    }>;
    message: string;
    explanation: string[];
  };
  customerRhythm?: {
    status: "READY" | "LEARNING";
    rhythmType:
      | "REGULAR"
      | "SEMI_REGULAR"
      | "OCCASIONAL"
      | "LEARNING";
    regularityScore: number | null;
    typicalIntervalHours: number | null;
    typicalIntervalLabel: string;
    nextExpectedAt: string | null;
    scheduleStatus:
      | "ON_TRACK"
      | "DUE"
      | "OVERDUE"
      | "LEARNING";
    overdueHours: number;
    recent30Days: number;
    previous30Days: number;
    frequencyChangePercent: number | null;
    frequencyTrend:
      | "INCREASING"
      | "DECLINING"
      | "STABLE"
      | "NEW_BASELINE"
      | "LEARNING";
    commutePattern: {
      detected: true;
      pickup: string;
      destination: string;
      observations: number;
      sharePercent: number;
      weekdayPercent: number;
      confidence: number;
    } | null;
    explanation: string[];
  };
  behaviourChange?: {
    status: "READY" | "LEARNING";
    windowDays: number;
    recentBookings: number;
    previousBookings: number;
    changeScore: number | null;
    direction:
      | "INCREASING"
      | "DECLINING"
      | "STABLE"
      | "MIXED"
      | "LEARNING";
    changes: Array<{
      category:
        | "FREQUENCY"
        | "OUTCOMES"
        | "TIME"
        | "PAYMENT"
        | "CHANNEL"
        | "PICKUP";
      severity:
        | "LOW"
        | "MEDIUM"
        | "HIGH";
      title: string;
      detail: string;
      evidence: string;
      sensitive: boolean;
    }>;
    explanation: string[];
  };
  serviceOutcomes?: {
    status: "READY" | "LEARNING";
    level:
      | "STABLE"
      | "MONITOR"
      | "REVIEW"
      | "URGENT_REVIEW"
      | "LEARNING";
    confidence: number;
    concludedBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    rejectedBookings: number;
    noFareBookings: number;
    overallAdverseRate: number;
    recentWindowSize: number;
    recentAdverseOutcomes: number;
    recentAdverseRate: number;
    previousAdverseRate: number | null;
    changePercentagePoints: number | null;
    consecutiveAdverseOutcomes: number;
    dominantAdverseOutcome:
      | "CANCELLED"
      | "REJECTED"
      | "NO_FARE"
      | null;
    serviceRecoveryRecommended: boolean;
    signals: string[];
    explanation: string[];
  };
  relationshipQuality?: {
    status: "READY" | "LEARNING";
    score: number | null;
    level:
      | "STRONG"
      | "ESTABLISHED"
      | "DEVELOPING"
      | "NEEDS_ATTENTION"
      | "LEARNING";
    completedBookings: number;
    completionRate: number;
    cancellationRate: number;
    noFareRate: number;
    relationshipAgeDays: number | null;
    daysSinceLastBooking: number | null;
    strengths: string[];
    attentionSignals: string[];
    explanation: string[];
  };
  operationalPreferences?: {
    status: "READY" | "LEARNING";
    analysedBookings: number;
    leadTime: {
      medianMinutes: number | null;
      medianLabel: string;
      immediateBookings: number;
      plannedBookings: number;
      advanceBookings: number;
      immediatePercentage: number;
      plannedPercentage: number;
      advancePercentage: number;
      preferredBookingStyle:
        | "IMMEDIATE"
        | "PLANNED"
        | "ADVANCE"
        | "MIXED"
        | "LEARNING";
    };
    passengers: {
      typical: number | null;
      maximum: number | null;
      multiPassengerPercentage: number;
    };
    luggageDataAvailable: boolean;
    commonRequirements: Array<{
      name: string;
      shortCode: string | null;
      bookings: number;
      percentage: number;
      category:
        | "ACCESSIBILITY"
        | "VEHICLE"
        | "TRAVEL"
        | "SERVICE"
        | "OTHER";
    }>;
    paymentPreference: {
      value: string | null;
      percentage: number;
    };
    bookingChannelPreference: {
      value: string | null;
      percentage: number;
    };
    explanation: string[];
  };
  needPropensity?: {
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
  nextBookingPrediction?: {
    status: "READY" | "LEARNING";
    signalStrength:
      | "HIGH"
      | "MODERATE"
      | "LOW"
      | "LEARNING";
    needScore: number | null;
    confidence: number;
    predictedDay: string | null;
    predictedHour: number | null;
    predictedWindow: string | null;
    predictedStartAt: string | null;
    pickup: string | null;
    destination: string | null;
    routeObservations: number;
    explanation: string[];
  };
  observation?: {
    weatherAvailable: boolean;
    enoughData: boolean;
    matchedBookings: number;
    rainyBookings: number;
    dryBookings: number;
    snowyBookings: number;
    foggyBookings: number;
    strongWindBookings: number;
    nightBookings: number;
    coldBookings: number;
    averageTemperature: number | null;
    averageApparentTemperature: number | null;
    rainyBookingPercentage: number;
    rainyHours: number;
    dryHours: number;
    rainyBookingsPer100Hours: number;
    dryBookingsPer100Hours: number;
    liftPercent: number | null;
    tendency:
      | "MORE_LIKELY_IN_RAIN"
      | "LESS_LIKELY_IN_RAIN"
      | "NO_CLEAR_DIFFERENCE"
      | "INSUFFICIENT_DATA";
    confidence: number;
    weatherMessage: string;
  };
};

type Tab =
  | "OVERVIEW"
  | "BEHAVIOUR"
  | "PLACES"
  | "BOOKINGS"
  | "OPPORTUNITIES";

function money(value: number | string | null) {
  const number = Number(value ?? 0);

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number.isFinite(number) ? number : 0);
}

function dateTime(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function readable(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1),
    )
    .join(" ");
}

export default function CustomerProfileDrawer({
  customerId,
  onClose,
}: {
  customerId: string;
  onClose: () => void;
}) {
  const [data, setData] =
    useState<ProfileResponse | null>(null);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState<string | null>(null);
  const [tab, setTab] =
    useState<Tab>("OVERVIEW");

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener(
      "keydown",
      closeOnEscape,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        closeOnEscape,
      );
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/dashboard/customers/${encodeURIComponent(customerId)}/profile`,
          {
            cache: "no-store",
          },
        );

        const payload =
          (await response.json()) as ProfileResponse;

        if (!response.ok || !payload.success) {
          throw new Error(
            payload.message ??
              "Customer profile could not be loaded.",
          );
        }

        if (!cancelled) {
          setData(payload);
        }
      } catch (error) {
        if (!cancelled) {
          setError(
            error instanceof Error
              ? error.message
              : "Customer profile could not be loaded.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const customer = data?.customer;
  const profile = data?.profile;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/75 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Close customer profile"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />

      <aside className="relative z-10 flex h-full w-full max-w-6xl flex-col overflow-hidden border-l border-slate-700 bg-slate-950 shadow-2xl">
        <header className="border-b border-slate-800 bg-slate-900/80 px-5 py-5 sm:px-7">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">
                Customer Intelligence
              </p>
              <h2 className="mt-2 text-2xl font-bold text-white">
                {customer?.name ??
                  (loading
                    ? "Loading profile…"
                    : "Customer Profile")}
              </h2>
              {customer ? (
                <p className="mt-2 text-sm text-slate-400">
                  {customer.telephoneNumber}
                  {customer.email
                    ? ` · ${customer.email}`
                    : ""}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 text-xl text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              ×
            </button>
          </div>

          {profile ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="blue">
                {readable(
                  profile.classification.lifecycle,
                )}
              </Badge>
              <Badge
                tone={
                  profile.classification
                    .profileSafeForPersonalisation
                    ? "green"
                    : "amber"
                }
              >
                {readable(
                  profile.classification.identityType,
                )}
              </Badge>
              <Badge tone="slate">
                Identity confidence{" "}
                {
                  profile.classification
                    .identityConfidence
                }
                %
              </Badge>
            </div>
          ) : null}
        </header>

        {profile ? (
          <nav className="flex gap-1 overflow-x-auto border-b border-slate-800 bg-slate-900 px-4 py-3 sm:px-7">
            {(
              [
                ["OVERVIEW", "Overview"],
                ["BEHAVIOUR", "Behaviour"],
                ["PLACES", "Places & Routes"],
                ["BOOKINGS", "Booking History"],
                ["OPPORTUNITIES", "Opportunities"],
              ] as Array<[Tab, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={[
                  "whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition",
                  tab === value
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </nav>
        ) : null}

        <div className="flex-1 overflow-y-auto p-5 sm:p-7">
          {loading ? (
            <div className="flex min-h-64 items-center justify-center text-slate-400">
              Building customer profile…
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-4 text-red-300">
              {error}
            </div>
          ) : profile && customer ? (
            <>
              {tab === "OVERVIEW" ? (
                <Overview
                  profile={profile}
                  dataQuality={
                    data?.profileDataQuality
                  }
                  prediction={
                    data?.nextBookingPrediction
                  }
                  propensity={
                    data?.needPropensity
                  }
                  relationship={
                    data?.relationshipQuality
                  }
                  weather={data?.observation}
                />
              ) : null}

              {tab === "BEHAVIOUR" ? (
                <Behaviour
                  profile={profile}
                  rhythm={
                    data?.customerRhythm
                  }
                  changes={
                    data?.behaviourChange
                  }
                  operational={
                    data?.operationalPreferences
                  }
                  contextual={
                    data?.contextualIntelligence
                  }
                  returnJourney={
                    data?.returnJourney
                  }
                />
              ) : null}

              {tab === "PLACES" ? (
                <Places
                  profile={profile}
                  placeIntelligence={
                    data?.placeIntelligence
                  }
                />
              ) : null}

              {tab === "BOOKINGS" ? (
                <Bookings profile={profile} />
              ) : null}

              {tab === "OPPORTUNITIES" ? (
                <Opportunities
                  profile={profile}
                  serviceOutcomes={
                    data?.serviceOutcomes
                  }
                />
              ) : null}
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function Overview({
  profile,
  dataQuality,
  prediction,
  propensity,
  relationship,
  weather,
}: {
  profile: NonNullable<
    ProfileResponse["profile"]
  >;
  dataQuality?: ProfileResponse["profileDataQuality"];
  prediction?: ProfileResponse["nextBookingPrediction"];
  propensity?: ProfileResponse["needPropensity"];
  relationship?: ProfileResponse["relationshipQuality"];
  weather?: ProfileResponse["observation"];
}) {
  const { overview, classification } = profile;

  return (
    <div className="space-y-6">
      {!classification
        .profileSafeForPersonalisation ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
          <p className="font-semibold text-amber-300">
            Personalisation safety warning
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-100/70">
            This number may represent a shared or
            business booking point. Personal predictions
            are disabled to avoid combining multiple
            passengers into one profile.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Total bookings"
          value={overview.totalBookings.toLocaleString(
            "en-GB",
          )}
        />
        <Metric
          label="Completed"
          value={overview.completed.toLocaleString(
            "en-GB",
          )}
          detail={`${overview.completionRate}% completion rate`}
        />
        <Metric
          label="Total spent"
          value={money(overview.totalSpent)}
          detail={`${money(overview.averageCompletedValue)} average`}
        />
        <Metric
          label="Last booking"
          value={dateTime(
            overview.lastBookingAt,
          )}
          detail={
            overview.daysSinceLastBooking === null
              ? "No activity recorded"
              : `${overview.daysSinceLastBooking} days ago`
          }
        />
        <Metric
          label="Cancelled"
          value={overview.cancelled.toLocaleString(
            "en-GB",
          )}
          detail={`${overview.cancellationRate}% of bookings`}
        />
        <Metric
          label="No Fare"
          value={overview.noFare.toLocaleString(
            "en-GB",
          )}
          detail={`${overview.noFareRate}% of bookings`}
        />
        <Metric
          label="Rejected"
          value={overview.rejected.toLocaleString(
            "en-GB",
          )}
        />
        <Metric
          label="Typical booking gap"
          value={`${overview.medianGapDays} days`}
          detail={`Observed since ${dateTime(overview.firstBookingAt)}`}
        />
      </div>

      {dataQuality ? (
        <Section title="Profile Evidence Quality">
          <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-sky-300">
                  Evidence completeness
                </p>
                <p className="mt-2 text-2xl font-bold text-white">
                  {readable(dataQuality.grade)}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Based on {dataQuality.totalBookings} stored
                  bookings and the coverage of each supporting
                  signal.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge
                  tone={
                    dataQuality.grade === "EXCELLENT"
                      ? "green"
                      : dataQuality.grade === "GOOD"
                        ? "blue"
                        : dataQuality.grade === "FAIR"
                          ? "amber"
                          : "slate"
                  }
                >
                  {dataQuality.score}/100
                </Badge>

                <Badge
                  tone={
                    dataQuality.readyForPrediction
                      ? "green"
                      : "slate"
                  }
                >
                  Prediction{" "}
                  {dataQuality.readyForPrediction
                    ? "ready"
                    : "learning"}
                </Badge>

                <Badge
                  tone={
                    dataQuality.readyForPlaceInsights
                      ? "green"
                      : "slate"
                  }
                >
                  Places{" "}
                  {dataQuality.readyForPlaceInsights
                    ? "ready"
                    : "learning"}
                </Badge>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                label="Time coverage"
                value={`${dataQuality.coverage.time}%`}
              />
              <Metric
                label="Zone coverage"
                value={`${dataQuality.coverage.zones}%`}
              />
              <Metric
                label="Weather coverage"
                value={`${dataQuality.coverage.weather}%`}
              />
              <Metric
                label="Verified place coverage"
                value={`${dataQuality.coverage.enrichedPlaces}%`}
              />
            </div>

            {dataQuality.strengths.length > 0 ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {dataQuality.strengths.map(
                  (strength) => (
                    <Badge
                      key={strength}
                      tone="green"
                    >
                      {strength}
                    </Badge>
                  ),
                )}
              </div>
            ) : null}

            {dataQuality.limitations.length > 0 ? (
              <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                  Current limitations
                </p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-100/70">
                  {dataQuality.limitations.map(
                    (limitation) => (
                      <li key={limitation}>
                        • {limitation}
                      </li>
                    ),
                  )}
                </ul>
              </div>
            ) : null}

            <p className="mt-4 text-xs leading-5 text-slate-500">
              This score measures data completeness, never
              customer quality. Protected locations remain
              hidden from behavioural details.
            </p>
          </div>
        </Section>
      ) : null}

      {relationship ? (
        <Section title="Relationship Quality">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
            {relationship.status === "READY" ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-emerald-300">
                      Observed relationship strength
                    </p>
                    <p className="mt-2 text-2xl font-bold text-white">
                      {relationship.level
                        .toLowerCase()
                        .replace("_", " ")}
                    </p>
                  </div>

                  <Badge
                    tone={
                      relationship.level ===
                      "NEEDS_ATTENTION"
                        ? "amber"
                        : relationship.level ===
                            "STRONG"
                          ? "green"
                          : "blue"
                    }
                  >
                    {relationship.score ?? 0}/100
                  </Badge>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Metric
                    label="Completion"
                    value={`${relationship.completionRate}%`}
                  />
                  <Metric
                    label="Cancellation"
                    value={`${relationship.cancellationRate}%`}
                  />
                  <Metric
                    label="No Fare"
                    value={`${relationship.noFareRate}%`}
                  />
                  <Metric
                    label="Relationship age"
                    value={
                      relationship
                        .relationshipAgeDays ===
                      null
                        ? "Learning"
                        : `${relationship.relationshipAgeDays} days`
                    }
                  />
                </div>

                {relationship.strengths.length >
                0 ? (
                  <div className="mt-5 rounded-xl border border-emerald-500/20 bg-slate-950/40 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Relationship strengths
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {relationship.strengths.map(
                        (strength) => (
                          <Badge
                            key={strength}
                            tone="green"
                          >
                            {strength}
                          </Badge>
                        ),
                      )}
                    </div>
                  </div>
                ) : null}

                {relationship.attentionSignals
                  .length > 0 ? (
                  <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                      Operational attention
                    </p>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-100/70">
                      {relationship.attentionSignals.map(
                        (signal) => (
                          <li
                            key={signal}
                            className="flex gap-2"
                          >
                            <span>•</span>
                            <span>{signal}</span>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                ) : null}

                <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    How it was calculated
                  </p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                    {relationship.explanation.map(
                      (reason) => (
                        <li
                          key={reason}
                          className="flex gap-2"
                        >
                          <span className="text-emerald-400">
                            •
                          </span>
                          <span>{reason}</span>
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-400">
                {relationship.explanation[0] ??
                  "More booking history is required."}
              </p>
            )}
          </div>
        </Section>
      ) : null}

      <Section title="Profile Insights">
        <div className="grid gap-3 lg:grid-cols-2">
          {profile.insights.map((insight) => (
            <div
              key={`${insight.title}-${insight.detail}`}
              className="rounded-xl border border-slate-800 bg-slate-900 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-white">
                  {insight.title}
                </p>
                <Badge
                  tone={
                    insight.type === "FACT"
                      ? "green"
                      : "blue"
                  }
                >
                  {insight.type} ·{" "}
                  {insight.confidence}%
                </Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {insight.detail}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {propensity &&
      classification.profileSafeForPersonalisation ? (
        <Section title="Operational Need Propensity">
          <div className="rounded-2xl border border-fuchsia-500/25 bg-fuchsia-500/5 p-5">
            {propensity.status === "READY" ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-fuchsia-300">
                      Combined observed signal
                    </p>
                    <p className="mt-2 text-3xl font-bold text-white">
                      {propensity.level}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      Recommended internal action:{" "}
                      {readable(
                        propensity.recommendedAction,
                      )}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge
                      tone={
                        propensity.level === "HIGH"
                          ? "amber"
                          : propensity.level ===
                              "ELEVATED"
                            ? "blue"
                            : "slate"
                      }
                    >
                      {propensity.score ?? 0}/100
                    </Badge>
                    <Badge tone="slate">
                      {propensity.confidence}% confidence
                    </Badge>
                    <Badge tone="slate">
                      {readable(
                        propensity.actionWindow,
                      )}
                    </Badge>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Metric
                    label="Booking prediction"
                    value={`${propensity.components.prediction}/55`}
                  />
                  <Metric
                    label="Schedule timing"
                    value={`${propensity.components.schedule}/25`}
                  />
                  <Metric
                    label="Rhythm regularity"
                    value={`${propensity.components.regularity}/10`}
                  />
                  <Metric
                    label="Return pattern"
                    value={`${propensity.components.returnPattern}/10`}
                  />
                </div>

                <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Evidence
                  </p>

                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                    {propensity.signals.map(
                      (signal) => (
                        <li
                          key={signal}
                          className="flex gap-2"
                        >
                          <span className="text-fuchsia-400">
                            •
                          </span>
                          <span>{signal}</span>
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              </>
            ) : (
              <p className="text-sm leading-6 text-slate-300">
                The combined propensity score is still
                learning from booking history.
              </p>
            )}

            <div className="mt-5 space-y-2 text-xs leading-5 text-slate-500">
              {propensity.explanation.map(
                (reason) => (
                  <p key={reason}>{reason}</p>
                ),
              )}
            </div>
          </div>
        </Section>
      ) : null}

      {prediction &&
      classification.profileSafeForPersonalisation ? (
        <Section title="Next Booking Prediction">
          <div className="rounded-2xl border border-violet-500/25 bg-violet-500/5 p-5">
            {prediction.status === "READY" ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-violet-300">
                      Most likely booking window
                    </p>
                    <p className="mt-2 text-2xl font-bold text-white">
                      {prediction.predictedDay},{" "}
                      {prediction.predictedWindow}
                    </p>
                    {prediction.pickup ||
                    prediction.destination ? (
                      <p className="mt-2 text-sm text-slate-300">
                        {prediction.pickup ??
                          "Unknown pickup"}
                        {" → "}
                        {prediction.destination ??
                          "Unknown destination"}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge tone="blue">
                      Need Score{" "}
                      {prediction.needScore ?? 0}/100
                    </Badge>
                    <Badge tone="slate">
                      {prediction.signalStrength} signal
                    </Badge>
                    <Badge tone="slate">
                      {prediction.confidence}% confidence
                    </Badge>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <Metric
                    label="Predicted day"
                    value={
                      prediction.predictedDay ??
                      "Learning"
                    }
                  />
                  <Metric
                    label="Time window"
                    value={
                      prediction.predictedWindow ??
                      "Learning"
                    }
                  />
                  <Metric
                    label="Route observations"
                    value={prediction.routeObservations.toString()}
                  />
                </div>

                <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Why this prediction
                  </p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                    {prediction.explanation.map(
                      (reason) => (
                        <li
                          key={reason}
                          className="flex gap-2"
                        >
                          <span className="text-violet-400">
                            •
                          </span>
                          <span>{reason}</span>
                        </li>
                      ),
                    )}
                  </ul>
                </div>

                <p className="mt-4 text-xs leading-5 text-slate-500">
                  Internal decision support only. No customer
                  message is sent automatically. Sensitive
                  destinations must never be mentioned in
                  promotional content.
                </p>
              </>
            ) : (
              <div>
                <p className="font-semibold text-white">
                  Learning this customer&apos;s pattern
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {prediction.explanation[0] ??
                    "More historical bookings are required."}
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  Current confidence:{" "}
                  {prediction.confidence}%
                </p>
              </div>
            )}
          </div>
        </Section>
      ) : null}

      {weather?.weatherAvailable ? (
        <Section title="Weather Intelligence">
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-white">
                  Rain sensitivity
                </p>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                  {weather.weatherMessage}
                </p>
              </div>

              <Badge
                tone={
                  weather.enoughData
                    ? "blue"
                    : "slate"
                }
              >
                {weather.confidence}% confidence
              </Badge>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                label="Weather-matched bookings"
                value={weather.matchedBookings.toString()}
              />
              <Metric
                label="During rain"
                value={`${weather.rainyBookings} (${weather.rainyBookingPercentage}%)`}
              />
              <Metric
                label="During dry weather"
                value={weather.dryBookings.toString()}
              />
              <Metric
                label="Rain effect"
                value={
                  weather.liftPercent === null
                    ? "Learning"
                    : `${weather.liftPercent > 0 ? "+" : ""}${weather.liftPercent}%`
                }
              />
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                label="Average temperature"
                value={
                  weather.averageTemperature === null
                    ? "No data"
                    : `${weather.averageTemperature}°C`
                }
              />
              <Metric
                label="Average feels like"
                value={
                  weather.averageApparentTemperature === null
                    ? "No data"
                    : `${weather.averageApparentTemperature}°C`
                }
              />
              <Metric
                label="Night bookings"
                value={weather.nightBookings.toString()}
              />
              <Metric
                label="Cold-weather bookings"
                value={weather.coldBookings.toString()}
              />
              <Metric
                label="Strong-wind bookings"
                value={weather.strongWindBookings.toString()}
              />
              <Metric
                label="Fog bookings"
                value={weather.foggyBookings.toString()}
              />
              <Metric
                label="Snow bookings"
                value={weather.snowyBookings.toString()}
              />
              <Metric
                label="Weather coverage"
                value={`${weather.matchedBookings} journeys`}
              />
            </div>

            <p className="mt-4 text-xs leading-5 text-slate-500">
              Comparison is normalised per 100 rainy and dry hours,
              so it does not assume that every rainy booking was
              caused by the weather.
            </p>
          </div>
        </Section>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
          Weather intelligence is waiting for historical observations.
        </div>
      )}
    </div>
  );
}

function Behaviour({
  profile,
  rhythm,
  changes,
  operational,
  contextual,
  returnJourney,
}: {
  profile: NonNullable<
    ProfileResponse["profile"]
  >;
  rhythm?: ProfileResponse["customerRhythm"];
  changes?: ProfileResponse["behaviourChange"];
  operational?: ProfileResponse["operationalPreferences"];
  contextual?: ProfileResponse["contextualIntelligence"];
  returnJourney?: ProfileResponse["returnJourney"];
}) {
  const safe =
    profile.classification
      .profileSafeForPersonalisation;

  return (
    <div className="space-y-6">
      {returnJourney ? (
        <Section title="Return Journey Intelligence">
          <div className="rounded-2xl border border-teal-500/20 bg-teal-500/5 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-teal-300">
                  Observed return behaviour
                </p>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                  {returnJourney.status === "READY"
                    ? `${returnJourney.returnPairs} reverse journeys were observed within 24 hours.`
                    : "More journeys are required to establish a reliable return pattern."}
                </p>
              </div>

              <Badge
                tone={
                  returnJourney.status === "READY"
                    ? "blue"
                    : "slate"
                }
              >
                {returnJourney.confidence}% confidence
              </Badge>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                label="Analysed journeys"
                value={returnJourney.analysedJourneys.toString()}
              />
              <Metric
                label="Observed returns"
                value={returnJourney.returnPairs.toString()}
                detail="Reverse journey within 24 hours"
              />
              <Metric
                label="Observed return rate"
                value={`${returnJourney.returnRate}%`}
                detail="Historical observation, not a guarantee"
              />
              <Metric
                label="Typical return time"
                value={returnJourney.typicalReturnLabel}
                detail={readable(
                  returnJourney.returnWindow,
                )}
              />
            </div>

            {returnJourney.strongestRoutes.length > 0 &&
            safe ? (
              <div className="mt-5 rounded-xl border border-teal-500/20 bg-slate-950/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Strongest return routes
                </p>

                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  {returnJourney.strongestRoutes.map(
                    (route) => (
                      <div
                        key={`${route.pickupZone}:${route.destinationZone}`}
                        className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-white">
                              {route.pickupZone}
                              {" ↔ "}
                              {route.destinationZone}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-slate-500">
                              Typical return after{" "}
                              {route.typicalReturnHours} hours
                            </p>
                          </div>

                          <Badge tone="blue">
                            {route.returnPairs} returns
                          </Badge>
                        </div>

                        <p className="mt-3 text-xs text-slate-500">
                          {route.sharePercent}% of observed
                          return pairs
                        </p>
                      </div>
                    ),
                  )}
                </div>
              </div>
            ) : null}

            {!safe &&
            returnJourney.strongestRoutes.length > 0 ? (
              <p className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm leading-6 text-amber-200/80">
                Route details are hidden because this may
                be a shared or business booking profile.
              </p>
            ) : null}

            <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Interpretation
              </p>

              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                {returnJourney.explanation.map(
                  (reason) => (
                    <li
                      key={reason}
                      className="flex gap-2"
                    >
                      <span className="text-teal-400">
                        •
                      </span>
                      <span>{reason}</span>
                    </li>
                  ),
                )}
              </ul>
            </div>

            <p className="mt-4 text-xs leading-5 text-slate-500">
              Protected journeys are excluded. This section
              describes historical operational patterns and
              does not infer why the customer travelled.
            </p>
          </div>
        </Section>
      ) : null}

      {contextual ? (
        <Section title="City & Event Context">
          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-purple-300">
                  Booking activity around recorded events
                </p>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                  {contextual.message}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge
                  tone={
                    contextual.status === "READY"
                      ? "blue"
                      : "slate"
                  }
                >
                  {contextual.confidence}% confidence
                </Badge>

                <Badge tone="slate">
                  {contextual.availableEvents} events evaluated
                </Badge>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                label="Event-associated bookings"
                value={contextual.matchedBookings.toString()}
                detail={`${contextual.matchedBookingPercentage}% of analysed bookings`}
              />
              <Metric
                label="During event hours"
                value={
                  contextual.eventBookingsPer100Hours ===
                  null
                    ? "Learning"
                    : `${contextual.eventBookingsPer100Hours} per 100h`
                }
                detail={`${contextual.eventHours} recorded event hours`}
              />
              <Metric
                label="During normal hours"
                value={
                  contextual.normalBookingsPer100Hours ===
                  null
                    ? "Learning"
                    : `${contextual.normalBookingsPer100Hours} per 100h`
                }
                detail={`${contextual.normalHours} comparison hours`}
              />
              <Metric
                label="Observed event effect"
                value={
                  contextual.liftPercent === null
                    ? "Learning"
                    : `${contextual.liftPercent > 0 ? "+" : ""}${contextual.liftPercent}%`
                }
                detail={readable(
                  contextual.tendency,
                )}
              />
            </div>

            {contextual.categories.length > 0 ? (
              <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Associated event categories
                </p>

                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {contextual.categories.map(
                    (category) => (
                      <div
                        key={category.category}
                        className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-semibold text-white">
                            {readable(
                              category.category,
                            )}
                          </p>
                          <Badge tone="blue">
                            {category.bookings} bookings
                          </Badge>
                        </div>

                        <p className="mt-2 text-xs leading-5 text-slate-500">
                          {category.events} recorded events ·{" "}
                          {category.percentage}% of analysed
                          bookings
                        </p>
                      </div>
                    ),
                  )}
                </div>
              </div>
            ) : null}

            {contextual.strongestAssociations
              .length > 0 ? (
              <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Strongest observed associations
                </p>

                <div className="mt-3 space-y-3">
                  {contextual.strongestAssociations.map(
                    (event) => (
                      <div
                        key={event.eventId}
                        className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-white">
                              {event.title}
                            </p>

                            <p className="mt-2 text-sm text-slate-400">
                              {readable(
                                event.category,
                              )}
                              {" · "}
                              {dateTime(
                                event.startsAt,
                              )}
                              {event.locationName
                                ? ` · ${event.locationName}`
                                : ""}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Badge
                              tone={
                                event.impactLevel ===
                                "HIGH"
                                  ? "amber"
                                  : "slate"
                              }
                            >
                              {event.impactLevel} impact
                            </Badge>

                            <Badge tone="blue">
                              {event.bookings} bookings
                            </Badge>
                          </div>
                        </div>

                        <p className="mt-3 text-xs text-slate-600">
                          Source: {event.source}
                        </p>
                      </div>
                    ),
                  )}
                </div>
              </div>
            ) : null}

            <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Interpretation
              </p>

              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                {contextual.explanation.map(
                  (reason) => (
                    <li
                      key={reason}
                      className="flex gap-2"
                    >
                      <span className="text-purple-400">
                        •
                      </span>
                      <span>{reason}</span>
                    </li>
                  ),
                )}
              </ul>
            </div>

            <p className="mt-4 text-xs leading-5 text-slate-500">
              Context is used to explain operational demand.
              It must not be presented as proof of a
              customer&apos;s motive or personal activity.
            </p>
          </div>
        </Section>
      ) : null}

      {rhythm ? (
        <Section title="Customer Rhythm">
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5">
            {rhythm.status === "READY" ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-cyan-300">
                      Observed booking rhythm
                    </p>
                    <p className="mt-2 text-2xl font-bold text-white">
                      {rhythm.rhythmType
                        .toLowerCase()
                        .replace("_", " ")}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge tone="blue">
                      Regularity{" "}
                      {rhythm.regularityScore ?? 0}/100
                    </Badge>
                    <Badge
                      tone={
                        rhythm.scheduleStatus ===
                        "OVERDUE"
                          ? "amber"
                          : "slate"
                      }
                    >
                      {rhythm.scheduleStatus
                        .toLowerCase()
                        .replace("_", " ")}
                    </Badge>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Metric
                    label="Typical interval"
                    value={
                      rhythm.typicalIntervalLabel
                    }
                  />
                  <Metric
                    label="Recent 30 days"
                    value={rhythm.recent30Days.toString()}
                  />
                  <Metric
                    label="Previous 30 days"
                    value={rhythm.previous30Days.toString()}
                  />
                  <Metric
                    label="Frequency change"
                    value={
                      rhythm.frequencyChangePercent ===
                      null
                        ? "New baseline"
                        : `${rhythm.frequencyChangePercent > 0 ? "+" : ""}${rhythm.frequencyChangePercent}%`
                    }
                  />
                </div>

                {rhythm.commutePattern &&
                safe ? (
                  <div className="mt-5 rounded-xl border border-cyan-500/20 bg-slate-950/40 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">
                          Possible recurring commute
                        </p>
                        <p className="mt-2 text-sm text-slate-300">
                          {
                            rhythm
                              .commutePattern
                              .pickup
                          }
                          {" → "}
                          {
                            rhythm
                              .commutePattern
                              .destination
                          }
                        </p>
                      </div>
                      <Badge tone="blue">
                        {
                          rhythm.commutePattern
                            .confidence
                        }
                        % confidence
                      </Badge>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-500">
                      {
                        rhythm.commutePattern
                          .observations
                      }{" "}
                      observed journeys ·{" "}
                      {
                        rhythm.commutePattern
                          .weekdayPercent
                      }
                      % occurred on weekdays
                    </p>
                  </div>
                ) : null}

                <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    How it was calculated
                  </p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                    {rhythm.explanation.map(
                      (reason) => (
                        <li
                          key={reason}
                          className="flex gap-2"
                        >
                          <span className="text-cyan-400">
                            •
                          </span>
                          <span>{reason}</span>
                        </li>
                      ),
                    )}
                  </ul>
                </div>

                <p className="mt-4 text-xs leading-5 text-slate-500">
                  Rhythm is inferred from booking history.
                  It is decision support, not proof of a
                  customer&apos;s personal routine.
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-400">
                {rhythm.explanation[0] ??
                  "More bookings are required to learn this rhythm."}
              </p>
            )}
          </div>
        </Section>
      ) : null}

      {changes ? (
        <Section title="Behaviour Changes">
          <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-5">
            {changes.status === "READY" ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-orange-300">
                      Latest {changes.windowDays} days versus previous{" "}
                      {changes.windowDays} days
                    </p>
                    <p className="mt-2 text-2xl font-bold text-white">
                      {changes.direction
                        .toLowerCase()
                        .replace("_", " ")}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge
                      tone={
                        changes.direction ===
                        "DECLINING"
                          ? "amber"
                          : changes.direction ===
                              "INCREASING"
                            ? "green"
                            : "blue"
                      }
                    >
                      Change Score{" "}
                      {changes.changeScore ?? 0}/100
                    </Badge>
                    <Badge tone="slate">
                      {changes.recentBookings} recent ·{" "}
                      {changes.previousBookings} previous
                    </Badge>
                  </div>
                </div>

                {changes.changes.filter(
                  (change) =>
                    !change.sensitive || safe,
                ).length > 0 ? (
                  <div className="mt-5 grid gap-3 lg:grid-cols-2">
                    {changes.changes
                      .filter(
                        (change) =>
                          !change.sensitive ||
                          safe,
                      )
                      .map((change) => (
                        <div
                          key={`${change.category}-${change.title}`}
                          className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-white">
                                {change.title}
                              </p>
                              <p className="mt-2 text-sm leading-6 text-slate-300">
                                {change.detail}
                              </p>
                            </div>
                            <Badge
                              tone={
                                change.severity ===
                                "HIGH"
                                  ? "amber"
                                  : "slate"
                              }
                            >
                              {change.severity}
                            </Badge>
                          </div>
                          <p className="mt-3 text-xs text-orange-300">
                            {change.evidence}
                          </p>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <p className="font-semibold text-emerald-300">
                      No material behavioural change detected
                    </p>
                    <p className="mt-2 text-sm text-slate-400">
                      Recent activity remains close to the previous comparison period.
                    </p>
                  </div>
                )}

                <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Interpretation rules
                  </p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                    {changes.explanation.map(
                      (reason) => (
                        <li
                          key={reason}
                          className="flex gap-2"
                        >
                          <span className="text-orange-400">
                            •
                          </span>
                          <span>{reason}</span>
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              </>
            ) : (
              <div>
                <p className="font-semibold text-white">
                  Still learning
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {changes.explanation.join(" ")}
                </p>
              </div>
            )}
          </div>
        </Section>
      ) : null}

      {operational ? (
        <Section title="Operational Preferences">
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-blue-300">
                  How this customer usually books
                </p>
                <p className="mt-2 text-2xl font-bold text-white">
                  {operational.leadTime
                    .preferredBookingStyle
                    .toLowerCase()
                    .replace("_", " ")}
                </p>
              </div>

              <Badge
                tone={
                  operational.status === "READY"
                    ? "blue"
                    : "slate"
                }
              >
                {operational.analysedBookings} bookings analysed
              </Badge>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                label="Typical notice"
                value={
                  operational.leadTime
                    .medianLabel
                }
              />
              <Metric
                label="Immediate bookings"
                value={`${operational.leadTime.immediatePercentage}%`}
              />
              <Metric
                label="Planned bookings"
                value={`${operational.leadTime.plannedPercentage}%`}
              />
              <Metric
                label="Advance bookings"
                value={`${operational.leadTime.advancePercentage}%`}
              />
              <Metric
                label="Preferred payment"
                value={
                  operational.paymentPreference
                    .value
                    ? `${operational.paymentPreference.value} (${operational.paymentPreference.percentage}%)`
                    : "Learning"
                }
              />
              <Metric
                label="Preferred channel"
                value={
                  operational
                    .bookingChannelPreference
                    .value
                    ? `${operational.bookingChannelPreference.value} (${operational.bookingChannelPreference.percentage}%)`
                    : "Learning"
                }
              />
              <Metric
                label="Typical passengers"
                value={
                  operational.passengers
                    .typical === null
                    ? "Not recorded"
                    : operational.passengers
                        .typical
                        .toString()
                }
              />
              <Metric
                label="Luggage"
                value={
                  operational
                    .luggageDataAvailable
                    ? "Recorded"
                    : "Not recorded"
                }
              />
            </div>

            {operational.commonRequirements
              .length > 0 ? (
              <div className="mt-5 rounded-xl border border-blue-500/20 bg-slate-950/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Repeated requirements
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {operational.commonRequirements.map(
                    (requirement) => (
                      <Badge
                        key={`${requirement.name}-${requirement.shortCode ?? ""}`}
                        tone="blue"
                      >
                        {requirement.name} ·{" "}
                        {requirement.bookings} bookings
                      </Badge>
                    ),
                  )}
                </div>
              </div>
            ) : null}

            <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Evidence
              </p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                {operational.explanation.map(
                  (reason) => (
                    <li
                      key={reason}
                      className="flex gap-2"
                    >
                      <span className="text-blue-400">
                        •
                      </span>
                      <span>{reason}</span>
                    </li>
                  ),
                )}
              </ul>
            </div>

            <p className="mt-4 text-xs leading-5 text-slate-500">
              Preferences are inferred only from recorded
              bookings. Missing passenger or luggage data is
              shown as unavailable and is never guessed.
            </p>
          </div>
        </Section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <RankedSection
          title="Bookings by Day"
          values={profile.behaviour.days}
        />
        <RankedSection
          title="Bookings by Hour"
          values={profile.behaviour.hours}
        />
        <RankedSection
          title="Payment Preferences"
          values={
            profile.behaviour.paymentMethods
          }
        />
        <RankedSection
          title="Booking Channels"
          values={
            profile.behaviour.bookingChannels
          }
        />
      </div>
    </div>
  );
}

function Places({
  profile,
  placeIntelligence,
}: {
  profile: NonNullable<
    ProfileResponse["profile"]
  >;
  placeIntelligence?:
    ProfileResponse["placeIntelligence"];
}) {
  return (
    <div className="space-y-6">
      <Section title="Verified Real-World Places">
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric
            label="Matched locations"
            value={(
              placeIntelligence
                ?.matchedLocations ?? 0
            ).toLocaleString("en-GB")}
          />
          <Metric
            label="Distinct places"
            value={(
              placeIntelligence
                ?.distinctPlaces ?? 0
            ).toLocaleString("en-GB")}
          />
          <Metric
            label="Protected places"
            value={(
              placeIntelligence
                ?.protectedPlaces ?? 0
            ).toLocaleString("en-GB")}
          />
        </div>

        <div className="mt-5 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm leading-6 text-slate-300">
          These are verified place matches from
          booking coordinates. A match identifies
          the physical place, but does not prove why
          the customer travelled there. Sensitive
          locations are protected automatically.
        </div>

        {placeIntelligence?.places.length ? (
          <div className="mt-5 overflow-x-auto rounded-xl border border-slate-800">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-950 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">
                    Place
                  </th>
                  <th className="px-4 py-3">
                    Category
                  </th>
                  <th className="px-4 py-3">
                    Use
                  </th>
                  <th className="px-4 py-3">
                    Bookings
                  </th>
                  <th className="px-4 py-3">
                    Confidence
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {placeIntelligence.places.map(
                  (place) => (
                    <tr
                      key={place.id}
                      className="bg-slate-900/50 align-top"
                    >
                      <td className="px-4 py-4">
                        <div className="font-semibold text-white">
                          {place.name ??
                            "Unnamed place"}
                        </div>

                        {place.formattedAddress ? (
                          <div className="mt-1 max-w-md text-xs leading-5 text-slate-500">
                            {
                              place.formattedAddress
                            }
                          </div>
                        ) : null}

                        {place.isSensitive ? (
                          <Badge tone="amber">
                            Protected
                          </Badge>
                        ) : null}
                      </td>

                      <td className="px-4 py-4 text-slate-300">
                        {place.category ??
                          "Uncategorised"}
                      </td>

                      <td className="px-4 py-4 text-slate-300">
                        <div>
                          {
                            place.pickupMatches
                          }{" "}
                          pickups
                        </div>
                        <div className="mt-1">
                          {
                            place.destinationMatches
                          }{" "}
                          destinations
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="font-semibold text-white">
                          {
                            place.linkedBookings
                          }
                        </div>
                        <div className="mt-1 max-w-xs text-xs leading-5 text-slate-600">
                          {place.bookingIds.join(
                            ", ",
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4 text-slate-300">
                        {place.confidence ===
                        null
                          ? "Provider match"
                          : `${Math.round(
                              place.confidence *
                                100,
                            )}%`}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/50 p-5 text-sm text-slate-400">
            No enriched places are connected to
            this customer yet. Run destination
            enrichment from Configuration to build
            this section.
          </div>
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <RankedSection
          title="Most Used Pickups"
          values={
            profile.places.topPickups
          }
        />
        <RankedSection
          title="Most Used Destinations"
          values={
            profile.places
              .topDestinations
          }
        />
      </div>
    </div>
  );
}

function Bookings({
  profile,
}: {
  profile: NonNullable<
    ProfileResponse["profile"]
  >;
}) {
  return (
    <Section title="Latest Bookings">
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-950 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">
                Booking
              </th>
              <th className="px-4 py-3">
                Status
              </th>
              <th className="px-4 py-3">
                Journey
              </th>
              <th className="px-4 py-3">
                Date
              </th>
              <th className="px-4 py-3 text-right">
                Price
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {profile.latestBookings.map(
              (booking) => {
                const pickup =
                  booking.locations.find(
                    (location) =>
                      location.type === "PICKUP",
                  );
                const destination =
                  booking.locations.find(
                    (location) =>
                      location.type ===
                      "DESTINATION",
                  );

                return (
                  <tr key={booking.externalId}>
                    <td className="px-4 py-4 font-semibold text-blue-400">
                      {booking.externalId}
                    </td>
                    <td className="px-4 py-4 text-slate-300">
                      {readable(booking.status)}
                    </td>
                    <td className="max-w-md px-4 py-4">
                      <p className="truncate text-slate-200">
                        {pickup?.address ?? "—"}
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        →{" "}
                        {destination?.address ??
                          "—"}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-400">
                      {dateTime(
                        booking.pickupDueTime ??
                          booking.bookedAtTime,
                      )}
                    </td>
                    <td className="px-4 py-4 text-right font-semibold text-white">
                      {money(booking.price)}
                    </td>
                  </tr>
                );
              },
            )}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function Opportunities({
  profile,
  serviceOutcomes,
}: {
  profile: NonNullable<
    ProfileResponse["profile"]
  >;
  serviceOutcomes?:
    ProfileResponse["serviceOutcomes"];
}) {
  return (
    <div className="space-y-4">
      {serviceOutcomes ? (
        <Section title="Service Outcome Review">
          <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-orange-300">
                  Recent concluded journey outcomes
                </p>
                <p className="mt-2 text-2xl font-bold text-white">
                  {readable(
                    serviceOutcomes.level,
                  )}
                </p>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                  {serviceOutcomes.serviceRecoveryRecommended
                    ? "Review recent journeys before making a commercial offer. A service recovery action may be appropriate."
                    : "No immediate service recovery action is required from the available evidence."}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge
                  tone={
                    serviceOutcomes.level ===
                      "URGENT_REVIEW" ||
                    serviceOutcomes.level ===
                      "REVIEW"
                      ? "amber"
                      : serviceOutcomes.level ===
                          "STABLE"
                        ? "green"
                        : "blue"
                  }
                >
                  {readable(
                    serviceOutcomes.level,
                  )}
                </Badge>
                <Badge tone="slate">
                  {serviceOutcomes.confidence}% confidence
                </Badge>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                label="Concluded bookings"
                value={serviceOutcomes.concludedBookings.toString()}
              />
              <Metric
                label="Overall adverse outcomes"
                value={`${serviceOutcomes.overallAdverseRate}%`}
                detail="Cancelled, rejected or no fare"
              />
              <Metric
                label="Recent adverse outcomes"
                value={`${serviceOutcomes.recentAdverseOutcomes}/${serviceOutcomes.recentWindowSize}`}
                detail={`${serviceOutcomes.recentAdverseRate}% in the recent window`}
              />
              <Metric
                label="Current adverse sequence"
                value={serviceOutcomes.consecutiveAdverseOutcomes.toString()}
                detail="Consecutive concluded bookings"
              />
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                label="Completed"
                value={serviceOutcomes.completedBookings.toString()}
              />
              <Metric
                label="Cancelled"
                value={serviceOutcomes.cancelledBookings.toString()}
              />
              <Metric
                label="Rejected"
                value={serviceOutcomes.rejectedBookings.toString()}
              />
              <Metric
                label="No Fare"
                value={serviceOutcomes.noFareBookings.toString()}
              />
            </div>

            {serviceOutcomes.changePercentagePoints !==
            null ? (
              <p className="mt-4 text-sm leading-6 text-slate-300">
                Recent adverse outcome rate changed by{" "}
                <span className="font-semibold text-white">
                  {serviceOutcomes.changePercentagePoints >
                  0
                    ? "+"
                    : ""}
                  {
                    serviceOutcomes
                      .changePercentagePoints
                  }{" "}
                  percentage points
                </span>{" "}
                versus earlier concluded bookings.
              </p>
            ) : null}

            <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Review signals
              </p>

              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                {serviceOutcomes.signals.map(
                  (signal) => (
                    <li
                      key={signal}
                      className="flex gap-2"
                    >
                      <span className="text-orange-400">
                        •
                      </span>
                      <span>{signal}</span>
                    </li>
                  ),
                )}
              </ul>
            </div>

            <div className="mt-5 space-y-2 text-xs leading-5 text-slate-500">
              {serviceOutcomes.explanation.map(
                (reason) => (
                  <p key={reason}>{reason}</p>
                ),
              )}
            </div>
          </div>
        </Section>
      ) : null}

      <Section title="Next Best Actions">
        <div className="space-y-3">
          {profile.opportunities.map(
            (opportunity) => (
              <div
                key={`${opportunity.action}-${opportunity.reason}`}
                className="rounded-xl border border-slate-800 bg-slate-900 p-5"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <Badge
                    tone={
                      opportunity.priority ===
                      "HIGH"
                        ? "amber"
                        : opportunity.priority ===
                            "MEDIUM"
                          ? "blue"
                          : "slate"
                    }
                  >
                    {opportunity.priority} priority
                  </Badge>
                  <p className="font-semibold text-white">
                    {opportunity.action}
                  </p>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {opportunity.reason}
                </p>
              </div>
            ),
          )}

          {profile.opportunities.length ===
          0 ? (
            <p className="text-sm text-slate-500">
              No action is recommended from the
              available evidence.
            </p>
          ) : null}
        </div>
      </Section>
    </div>
  );
}

function RankedSection({
  title,
  values,
}: {
  title: string;
  values: RankedValue[];
}) {
  return (
    <Section title={title}>
      <div className="space-y-4">
        {values.map((value) => (
          <div key={value.label}>
            <div className="mb-2 flex items-center justify-between gap-4 text-sm">
              <span className="font-medium text-slate-200">
                {value.label}
              </span>
              <span className="text-slate-500">
                {value.count} · {value.percentage}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-blue-500"
                style={{
                  width: `${Math.max(value.percentage, 2)}%`,
                }}
              />
            </div>
          </div>
        ))}

        {values.length === 0 ? (
          <p className="text-sm text-slate-500">
            Not enough data yet.
          </p>
        ) : null}
      </div>
    </Section>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
      <h3 className="text-lg font-semibold text-white">
        {title}
      </h3>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-2xl font-bold text-white">
        {value}
      </p>
      {detail ? (
        <p className="mt-2 text-xs leading-5 text-slate-500">
          {detail}
        </p>
      ) : null}
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "blue" | "green" | "amber" | "slate";
}) {
  const styles = {
    blue: "border-blue-500/30 bg-blue-500/10 text-blue-300",
    green:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    amber:
      "border-amber-500/30 bg-amber-500/10 text-amber-300",
    slate:
      "border-slate-700 bg-slate-800 text-slate-300",
  };

  return (
    <span
      className={[
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
        styles[tone],
      ].join(" ")}
    >
      {children}
    </span>
  );
}
