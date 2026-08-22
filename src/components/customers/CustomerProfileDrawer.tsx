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
                  weather={data?.observation}
                />
              ) : null}

              {tab === "BEHAVIOUR" ? (
                <Behaviour
                  profile={profile}
                />
              ) : null}

              {tab === "PLACES" ? (
                <Places profile={profile} />
              ) : null}

              {tab === "BOOKINGS" ? (
                <Bookings profile={profile} />
              ) : null}

              {tab === "OPPORTUNITIES" ? (
                <Opportunities
                  profile={profile}
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
  weather,
}: {
  profile: NonNullable<
    ProfileResponse["profile"]
  >;
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
}: {
  profile: NonNullable<
    ProfileResponse["profile"]
  >;
}) {
  return (
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
  );
}

function Places({
  profile,
}: {
  profile: NonNullable<
    ProfileResponse["profile"]
  >;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <RankedSection
        title="Most Used Pickups"
        values={profile.places.topPickups}
      />
      <RankedSection
        title="Most Used Destinations"
        values={
          profile.places.topDestinations
        }
      />
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
}: {
  profile: NonNullable<
    ProfileResponse["profile"]
  >;
}) {
  return (
    <div className="space-y-4">
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
