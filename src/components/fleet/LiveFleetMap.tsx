"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import {
  Marker,
  MapContainer,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Driver = {
  id: string;
  externalId: string;
  callsign: string | null;
  name: string | null;
  badgeNumber: string | null;
};

type LiveVehicle = {
  id: string;
  provider: string;
  externalId: string;
  callsign: string | null;
  registration: string | null;
  status: string;
  operationalStatus: "CLEAR" | "DOW" | "DAP" | "POB";
  bookingId: number | null;
  pickupAddress: string | null;
  destinationAddress: string | null;
  latitude: number;
  longitude: number;
  lastSeenAt: string | null;
  ageSeconds: number | null;
  isLive: boolean;
  driver: Driver | null;
};

function vehicleIcon(colour: string) {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width:32px;
        height:32px;
        border-radius:10px;
        background:${colour};
        border:2px solid #ffffff;
        display:flex;
        align-items:center;
        justify-content:center;
        box-shadow:0 2px 8px rgba(15,23,42,.45);
        font-size:18px;
        line-height:1;
      ">🚕</div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
    tooltipAnchor: [0, -18],
  });
}

function operationalStatusFromVehicleStatus(
  status: string,
): "CLEAR" | "DOW" | "POB" {
  if (
    status === "BusyMeterOnFromClear" ||
    status === "BusyMeterOnFromMeterOffCash" ||
    status === "BusyMeterOnFromMeterOffAccount"
  ) {
    return "POB";
  }

  if (
    status === "BusyMeterOff" ||
    status === "BusyMeterOffAccount"
  ) {
    return "DOW";
  }

  return "CLEAR";
}

type FleetSummary = {
  total: number;
  live: number;
  stale: number;
  clear: number;
  busy: number;
  notWorking: number;
};

type LiveFleetResponse = {
  generatedAt: string;
  refreshAfterSeconds: number;
  summary: FleetSummary;
  vehicles: LiveVehicle[];
};

type FleetVehicleUpdatedMessage = {
  type: "fleet.vehicle.updated";
  sentAt: string;
  vehicle: {
    id: string;
    provider: string;
    externalId: string;
    callsign: string | null;
    registration: string | null;
    status: string;
    bookingId: number | null;
    latitude: number;
    longitude: number;
    lastSeenAt: string;
    isLive: boolean;
    driver: Driver | null;
  };
};

type ConnectionStatus =
  | "CONNECTING"
  | "LIVE"
  | "RECONNECTING"
  | "OFFLINE";

const PLYMOUTH_CENTER: [number, number] = [50.3755, -4.1427];
const FALLBACK_POLL_INTERVAL_MS = 5_000;
const RECONNECT_BASE_DELAY_MS = 1_000;
const RECONNECT_MAX_DELAY_MS = 15_000;
const LIVE_THRESHOLD_SECONDS = 120;

function statusColour(status: string, isLive: boolean): string {
  if (!isLive) {
    return "#64748b";
  }

  switch (status) {
    case "Clear":
      return "#22c55e";

    case "BusyMeterOff":
    case "BusyMeterOffAccount":
      return "#f59e0b";

    case "BusyMeterOnFromClear":
    case "BusyMeterOnFromMeterOffCash":
    case "BusyMeterOnFromMeterOffAccount":
      return "#ef4444";

    case "NotWorking":
      return "#475569";

    default:
      return "#3b82f6";
  }
}

function isBusyStatus(status: string): boolean {
  return (
    status === "BusyMeterOff" ||
    status === "BusyMeterOffAccount" ||
    status.startsWith("BusyMeterOn")
  );
}

function calculateVehicleAge(
  lastSeenAt: string | null,
  now: number,
): number | null {
  if (!lastSeenAt) {
    return null;
  }

  const timestamp = new Date(lastSeenAt).getTime();

  if (Number.isNaN(timestamp)) {
    return null;
  }

  return Math.max(0, Math.floor((now - timestamp) / 1_000));
}

function formatAge(ageSeconds: number | null): string {
  if (ageSeconds === null) {
    return "Unknown";
  }

  if (ageSeconds < 60) {
    return `${ageSeconds}s ago`;
  }

  const minutes = Math.floor(ageSeconds / 60);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  return `${hours}h ago`;
}

function calculateSummary(
  vehicles: LiveVehicle[],
  now: number,
): FleetSummary {
  return vehicles.reduce<FleetSummary>(
    (summary, vehicle) => {
      const ageSeconds = calculateVehicleAge(
        vehicle.lastSeenAt,
        now,
      );

      const isLive =
        ageSeconds !== null &&
        ageSeconds <= LIVE_THRESHOLD_SECONDS;

      summary.total += 1;

      if (isLive) {
        summary.live += 1;
      } else {
        summary.stale += 1;
      }

      if (vehicle.status === "Clear") {
        summary.clear += 1;
      }

      if (isBusyStatus(vehicle.status)) {
        summary.busy += 1;
      }

      if (vehicle.status === "NotWorking") {
        summary.notWorking += 1;
      }

      return summary;
    },
    {
      total: 0,
      live: 0,
      stale: 0,
      clear: 0,
      busy: 0,
      notWorking: 0,
    },
  );
}

function ConnectionBadge({
  status,
}: {
  status: ConnectionStatus;
}) {
  const config: Record<
    ConnectionStatus,
    {
      label: string;
      className: string;
    }
  > = {
    CONNECTING: {
      label: "Connecting",
      className:
        "border-blue-500/30 bg-blue-500/10 text-blue-300",
    },
    LIVE: {
      label: "Live",
      className:
        "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    },
    RECONNECTING: {
      label: "Reconnecting",
      className:
        "border-amber-500/30 bg-amber-500/10 text-amber-300",
    },
    OFFLINE: {
      label: "Offline · HTTP fallback",
      className:
        "border-red-500/30 bg-red-500/10 text-red-300",
    },
  };

  const current = config[status];

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${current.className}`}
    >
      <span className="relative flex h-2 w-2">
        {status === "LIVE" && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        )}

        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${
            status === "LIVE"
              ? "bg-emerald-400"
              : status === "CONNECTING"
                ? "bg-blue-400"
                : status === "RECONNECTING"
                  ? "bg-amber-400"
                  : "bg-red-400"
          }`}
        />
      </span>

      {current.label}
    </span>
  );
}

function FitFleetBounds({
  vehicles,
  fitRequestKey,
}: {
  vehicles: LiveVehicle[];
  fitRequestKey: string;
}) {
  const map = useMap();
  const previousFitRequestKey = useRef<string | null>(null);

  useEffect(() => {
    if (previousFitRequestKey.current === fitRequestKey) {
      return;
    }

    previousFitRequestKey.current = fitRequestKey;

    if (vehicles.length === 0) {
      map.setView(PLYMOUTH_CENTER, 12);
      return;
    }

    const bounds = L.latLngBounds(
      vehicles.map(
        (vehicle) =>
          [vehicle.latitude, vehicle.longitude] as [
            number,
            number,
          ],
      ),
    );

    map.fitBounds(bounds, {
      padding: [40, 40],
      maxZoom: 15,
    });
  }, [fitRequestKey, map, vehicles]);

  return null;
}

export default function LiveFleetMap() {
  const [data, setData] =
    useState<LiveFleetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("CONNECTING");
  const [lastRealtimeUpdate, setLastRealtimeUpdate] =
    useState<string | null>(null);
  const [clock, setClock] = useState(() => Date.now());

  const websocketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const fallbackIntervalRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const componentActiveRef = useRef(true);

  const loadFleet = useCallback(async () => {
    try {
      const response = await fetch("/api/fleet/live", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(
          `Request failed with status ${response.status}`,
        );
      }

      const payload =
        (await response.json()) as LiveFleetResponse;

      if (!componentActiveRef.current) {
        return;
      }

      setData(payload);
      setError(null);
    } catch (requestError) {
      console.error(requestError);

      if (componentActiveRef.current) {
        setError("Live fleet data could not be loaded.");
      }
    } finally {
      if (componentActiveRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const stopFallbackPolling = useCallback(() => {
    if (fallbackIntervalRef.current !== null) {
      window.clearInterval(fallbackIntervalRef.current);
      fallbackIntervalRef.current = null;
    }
  }, []);

  const startFallbackPolling = useCallback(() => {
    if (fallbackIntervalRef.current !== null) {
      return;
    }

    void loadFleet();

    fallbackIntervalRef.current = window.setInterval(() => {
      void loadFleet();
    }, FALLBACK_POLL_INTERVAL_MS);
  }, [loadFleet]);

  const applyVehicleUpdate = useCallback(
    (message: FleetVehicleUpdatedMessage) => {
      const incomingVehicle = message.vehicle;

      setData((currentData) => {
        if (!currentData) {
          return currentData;
        }

        const existingVehicle = currentData.vehicles.find(
          (item) => item.id === incomingVehicle.id,
        );

        const sameBooking =
          existingVehicle?.bookingId === incomingVehicle.bookingId;

        const trackedStatus =
          operationalStatusFromVehicleStatus(
            incomingVehicle.status,
          );

        const vehicle: LiveVehicle = {
          ...incomingVehicle,
          operationalStatus:
            sameBooking &&
            (existingVehicle?.operationalStatus === "DAP" ||
              existingVehicle?.operationalStatus === "POB")
              ? existingVehicle.operationalStatus
              : trackedStatus,
          pickupAddress: sameBooking
            ? existingVehicle?.pickupAddress ?? null
            : null,
          destinationAddress: sameBooking
            ? existingVehicle?.destinationAddress ?? null
            : null,
          ageSeconds: 0,
          isLive: true,
        };

        const existingIndex =
          currentData.vehicles.findIndex(
            (item) => item.id === vehicle.id,
          );

        let vehicles: LiveVehicle[];

        if (existingIndex === -1) {
          vehicles = [...currentData.vehicles, vehicle];
        } else {
          vehicles = currentData.vehicles.map((item) =>
            item.id === vehicle.id
              ? {
                  ...item,
                  ...vehicle,
                }
              : item,
          );
        }

        return {
          ...currentData,
          generatedAt: message.sentAt,
          summary: calculateSummary(
            vehicles,
            Date.now(),
          ),
          vehicles,
        };
      });

      setLastRealtimeUpdate(message.sentAt);
      setError(null);
    },
    [],
  );

  const connectWebSocket = useCallback(() => {
    if (!componentActiveRef.current) {
      return;
    }

    if (
      websocketRef.current?.readyState === WebSocket.OPEN ||
      websocketRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    setConnectionStatus(
      reconnectAttemptRef.current === 0
        ? "CONNECTING"
        : "RECONNECTING",
    );

    const protocol =
      window.location.protocol === "https:"
        ? "wss:"
        : "ws:";

    const socket = new WebSocket(
      `${protocol}//${window.location.host}/ws/fleet`,
    );

    websocketRef.current = socket;

    socket.addEventListener("open", () => {
      if (!componentActiveRef.current) {
        socket.close();
        return;
      }

      reconnectAttemptRef.current = 0;
      setConnectionStatus("LIVE");
      stopFallbackPolling();
    });

    socket.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(
          event.data as string,
        ) as {
          type?: string;
        };

        if (message.type === "fleet.vehicle.updated") {
          applyVehicleUpdate(
            message as FleetVehicleUpdatedMessage,
          );
        }

        if (message.type === "server.shutdown") {
          setConnectionStatus("RECONNECTING");
        }
      } catch (messageError) {
        console.error(
          "Invalid WebSocket message:",
          messageError,
        );
      }
    });

    socket.addEventListener("error", () => {
      if (componentActiveRef.current) {
        setConnectionStatus("OFFLINE");
        startFallbackPolling();
      }
    });

    socket.addEventListener("close", () => {
      websocketRef.current = null;

      if (!componentActiveRef.current) {
        return;
      }

      setConnectionStatus("RECONNECTING");
      startFallbackPolling();

      reconnectAttemptRef.current += 1;

      const reconnectDelay = Math.min(
        RECONNECT_BASE_DELAY_MS *
          2 **
            Math.min(
              reconnectAttemptRef.current - 1,
              4,
            ),
        RECONNECT_MAX_DELAY_MS,
      );

      reconnectTimerRef.current = window.setTimeout(() => {
        connectWebSocket();
      }, reconnectDelay);
    });
  }, [
    applyVehicleUpdate,
    startFallbackPolling,
    stopFallbackPolling,
  ]);

  useEffect(() => {
    componentActiveRef.current = true;

    void loadFleet();
    connectWebSocket();

    const clockInterval = window.setInterval(() => {
      setClock(Date.now());
    }, 1_000);

    return () => {
      componentActiveRef.current = false;

      window.clearInterval(clockInterval);

      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }

      stopFallbackPolling();

      const socket = websocketRef.current;
      websocketRef.current = null;

      if (socket) {
        socket.close(1000, "Component unmounted");
      }
    };
  }, [
    connectWebSocket,
    loadFleet,
    stopFallbackPolling,
  ]);

  const vehiclesWithCurrentAge = useMemo(() => {
    return (data?.vehicles ?? []).map((vehicle) => {
      const ageSeconds = calculateVehicleAge(
        vehicle.lastSeenAt,
        clock,
      );

      return {
        ...vehicle,
        ageSeconds,
        isLive:
          ageSeconds !== null &&
          ageSeconds <= LIVE_THRESHOLD_SECONDS,
      };
    });
  }, [clock, data?.vehicles]);

  const summary = useMemo(
    () => calculateSummary(vehiclesWithCurrentAge, clock),
    [clock, vehiclesWithCurrentAge],
  );

  const filteredVehicles = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLowerCase();

    return vehiclesWithCurrentAge.filter((vehicle) => {
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "LIVE" && vehicle.isLive) ||
        (statusFilter === "STALE" && !vehicle.isLive) ||
        vehicle.status === statusFilter;

      if (!matchesStatus) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchableValues = [
        vehicle.callsign,
        vehicle.registration,
        vehicle.externalId,
        vehicle.driver?.callsign,
        vehicle.driver?.name,
        vehicle.driver?.badgeNumber,
        vehicle.bookingId?.toString(),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableValues.includes(normalizedSearch);
    });
  }, [
    search,
    statusFilter,
    vehiclesWithCurrentAge,
  ]);

  const mapFitRequestKey = `${statusFilter}:${search.trim().toLowerCase()}`;

  if (loading) {
    return (
      <div className="flex min-h-[620px] items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-slate-400">
        Loading live fleet map...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-6 text-red-200">
        {error || "Live fleet data is unavailable."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">
            Live Fleet Connection
          </p>

          <p className="mt-1 text-xs text-slate-500">
            WebSocket realtime updates with five-second HTTP
            fallback
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <ConnectionBadge status={connectionStatus} />

          {lastRealtimeUpdate && (
            <span className="text-xs text-slate-500">
              Last event{" "}
              {new Date(
                lastRealtimeUpdate,
              ).toLocaleTimeString("en-GB")}
            </span>
          )}
        </div>
      </div>

      {error && connectionStatus !== "LIVE" && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {error} Existing map data remains visible while the
          connection retries.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ["Total", summary.total],
          ["Live", summary.live],
          ["Available", summary.clear],
          ["Busy", summary.busy],
          ["Not Working", summary.notWorking],
          ["Stale", summary.stale],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {label}
            </p>

            <p className="mt-2 text-2xl font-bold text-white">
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search driver, callsign, vehicle or booking..."
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500 sm:w-80"
          />

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500"
          >
            <option value="ALL">All vehicles</option>
            <option value="LIVE">Live only</option>
            <option value="STALE">Stale only</option>
            <option value="Clear">Available</option>
            <option value="BusyMeterOff">
              On the way
            </option>
            <option value="BusyMeterOffAccount">
              On the way · Account
            </option>
            <option value="BusyMeterOnFromClear">
              Busy from clear
            </option>
            <option value="BusyMeterOnFromMeterOffCash">
              Passenger on board · Cash
            </option>
            <option value="BusyMeterOnFromMeterOffAccount">
              Passenger on board · Account
            </option>
            <option value="NotWorking">
              Not working
            </option>
          </select>
        </div>

        <div className="text-sm text-slate-500">
          Showing{" "}
          <span className="font-semibold text-white">
            {filteredVehicles.length}
          </span>{" "}
          vehicles · Updated{" "}
          {new Date(
            lastRealtimeUpdate ??
              data.generatedAt,
          ).toLocaleTimeString("en-GB")}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <MapContainer
          center={PLYMOUTH_CENTER}
          zoom={12}
          scrollWheelZoom
          className="h-[680px] w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <FitFleetBounds
            vehicles={filteredVehicles}
            fitRequestKey={mapFitRequestKey}
          />

          {filteredVehicles.map((vehicle) => {
            const colour = statusColour(
              vehicle.status,
              vehicle.isLive,
            );

            return (
              <Marker
                key={vehicle.id}
                position={[
                  vehicle.latitude,
                  vehicle.longitude,
                ]}
                icon={vehicleIcon(colour)}
              >
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -8]}
                  opacity={0.95}
                  className="fleet-callsign-tooltip"
                >
                  {(vehicle.driver?.callsign ||
                    vehicle.callsign ||
                    vehicle.externalId) +
                    " · " +
                    vehicle.operationalStatus}
                </Tooltip>

                <Popup>
                  <div className="min-w-56 text-sm">
                    <p className="text-base font-bold">
                      Driver{" "}
                      {vehicle.driver?.callsign ||
                        vehicle.callsign ||
                        "—"}
                    </p>

                    <div className="mt-2 space-y-1">
                      <p>
                        <strong>Name:</strong>{" "}
                        {vehicle.driver?.name ||
                          "Not available"}
                      </p>

                      <p>
                        <strong>Vehicle:</strong>{" "}
                        {vehicle.registration ||
                          vehicle.callsign ||
                          vehicle.externalId}
                      </p>

                      <p>
                        <strong>Status:</strong>{" "}
                        {vehicle.operationalStatus === "CLEAR"
                          ? "CLEAR - Available"
                          : vehicle.operationalStatus === "DOW"
                            ? "DOW - Driver On The Way"
                            : vehicle.operationalStatus === "DAP"
                              ? "DAP - Driver At Pickup"
                              : "POB - Passenger On Board"}
                      </p>

                      {(vehicle.operationalStatus === "DOW" ||
                        vehicle.operationalStatus === "DAP") ? (
                        <p>
                          <strong>Pickup:</strong>{" "}
                          {vehicle.pickupAddress || "Not available"}
                        </p>
                      ) : null}

                      {vehicle.operationalStatus === "POB" ? (
                        <p>
                          <strong>Destination:</strong>{" "}
                          {vehicle.destinationAddress || "Not available"}
                        </p>
                      ) : null}

                      <p>
                        <strong>Booking:</strong>{" "}
                        {vehicle.bookingId ?? "None"}
                      </p>

                      <p>
                        <strong>Last update:</strong>{" "}
                        {formatAge(vehicle.ageSeconds)}
                      </p>

                      <p>
                        <strong>Connection:</strong>{" "}
                        {vehicle.isLive
                          ? "Live"
                          : "Stale"}
                      </p>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
