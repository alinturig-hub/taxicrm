"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type DriverRentConfiguration = {
  rentPercentage: number;
  weeklyCap: number;
  fullRentThreshold: number;
  updatedAt: string;
};

export default function DriverRentSettings() {
  const [rentPercentage, setRentPercentage] =
    useState("20");
  const [weeklyCap, setWeeklyCap] =
    useState("160");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] =
    useState<string | null>(null);
  const [message, setMessage] =
    useState<string | null>(null);

  const loadConfiguration = useCallback(
    async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          "/api/dashboard/configuration/driver-rent",
          {
            cache: "no-store",
          },
        );

        const payload = (await response.json()) as {
          success?: boolean;
          message?: string;
          configuration?:
            DriverRentConfiguration;
        };

        if (
          !response.ok ||
          !payload.success ||
          !payload.configuration
        ) {
          throw new Error(
            payload.message ??
              "Driver rent settings could not be loaded.",
          );
        }

        setRentPercentage(
          String(
            payload.configuration.rentPercentage,
          ),
        );
        setWeeklyCap(
          String(payload.configuration.weeklyCap),
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Driver rent settings could not be loaded.",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadConfiguration();
  }, [loadConfiguration]);

  const threshold = useMemo(() => {
    const percentage = Number(rentPercentage);
    const cap = Number(weeklyCap);

    if (
      !Number.isFinite(percentage) ||
      percentage <= 0 ||
      !Number.isFinite(cap) ||
      cap <= 0
    ) {
      return 0;
    }

    return cap / (percentage / 100);
  }, [rentPercentage, weeklyCap]);

  const saveConfiguration = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        "/api/dashboard/configuration/driver-rent",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            rentPercentage:
              Number(rentPercentage),
            weeklyCap: Number(weeklyCap),
          }),
        },
      );

      const payload = (await response.json()) as {
        success?: boolean;
        message?: string;
        configuration?:
          DriverRentConfiguration;
      };

      if (
        !response.ok ||
        !payload.success ||
        !payload.configuration
      ) {
        throw new Error(
          payload.message ??
            "Driver rent settings could not be saved.",
        );
      }

      setRentPercentage(
        String(
          payload.configuration.rentPercentage,
        ),
      );
      setWeeklyCap(
        String(payload.configuration.weeklyCap),
      );
      setMessage(
        "Driver rent settings saved successfully.",
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Driver rent settings could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-400">
        Loading driver rent settings...
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-black/10">
      <div className="grid gap-5 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold text-slate-200">
            Rent percentage
          </span>

          <div className="mt-2 flex overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
            <input
              type="number"
              min="0.01"
              max="100"
              step="0.01"
              value={rentPercentage}
              onChange={(event) =>
                setRentPercentage(
                  event.target.value,
                )
              }
              className="min-w-0 flex-1 bg-transparent px-4 py-3 text-lg font-semibold text-white outline-none"
            />

            <span className="flex items-center border-l border-slate-700 px-4 text-slate-400">
              %
            </span>
          </div>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-200">
            Weekly cap
          </span>

          <div className="mt-2 flex overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
            <span className="flex items-center border-r border-slate-700 px-4 text-slate-400">
              £
            </span>

            <input
              type="number"
              min="0.01"
              max="10000"
              step="0.01"
              value={weeklyCap}
              onChange={(event) =>
                setWeeklyCap(event.target.value)
              }
              className="min-w-0 flex-1 bg-transparent px-4 py-3 text-lg font-semibold text-white outline-none"
            />
          </div>
        </label>
      </div>

      <div className="mt-6 rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
        <p className="text-sm text-blue-100">
          With these settings, a driver reaches
          Full Rent after earning{" "}
          <strong>
            {new Intl.NumberFormat("en-GB", {
              style: "currency",
              currency: "GBP",
            }).format(threshold)}
          </strong>{" "}
          during the week.
        </p>

        <p className="mt-2 text-xs leading-5 text-blue-300/70">
          The week runs Monday 00:00 through
          Sunday 23:59 in Europe/London.
          Rent is calculated as the percentage of
          driver earnings, limited by the weekly cap.
        </p>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-red-400">
          {error}
        </p>
      ) : null}

      {message ? (
        <p className="mt-4 text-sm text-emerald-400">
          {message}
        </p>
      ) : null}

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={() =>
            void saveConfiguration()
          }
          className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving
            ? "Saving..."
            : "Save Driver Rent Settings"}
        </button>
      </div>
    </section>
  );
}
