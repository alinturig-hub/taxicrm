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
  todayRevenue: number;
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function vehicleIcon(colour: string, label: string) {
  return L.divIcon({
    className: "fleet-vehicle-div-icon",
    html: `
      <div class="fleet-vehicle-marker">
        <span class="fleet-vehicle-label" style="border-color:${colour}">${escapeHtml(label)}</span>
        <img class="fleet-vehicle-car" src="/fleet-car-top.png" alt="" draggable="false" />
        <span class="fleet-vehicle-status" style="background:${colour}"></span>
      </div>
    `,
    iconSize: [48, 72],
    iconAnchor: [24, 42],
    popupAnchor: [0, -38],
    tooltipAnchor: [0, -38],
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

const PLYMOUTH_CENTER: [number, number] = [50.3707, -4.1422];
const CITY_CENTRE_ZOOM = 14;
const FALLBACK_POLL_INTERVAL_MS = 5_000;
const CONNECTED_POLL_INTERVAL_MS = 15_000;
const RECONNECT_BASE_DELAY_MS = 1_000;
const RECONNECT_MAX_DELAY_MS = 15_000;
const LIVE_THRESHOLD_SECONDS = 120;

function statusColour(status: string, isLive: boolean, operationalStatus: LiveVehicle["operationalStatus"]): string {
  if (!isLive) {
    return "#64748b";
  }

  if (operationalStatus === "POB") return "#ef4444";
  if (operationalStatus === "DAP" || operationalStatus === "DOW") return "#f59e0b";

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
      label: "Connected",
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
  const previousFitRequestKey = useRef(fitRequestKey);

  useEffect(() => {
    if (previousFitRequestKey.current === fitRequestKey) {
      return;
    }

    previousFitRequestKey.current = fitRequestKey;

    if (vehicles.length === 0) return;

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

function ResizeFleetMap() {
  const map = useMap();

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);

  return null;
}

function movementBearing(
  from: [number, number],
  to: [number, number],
): number {
  const latitude1 = (from[0] * Math.PI) / 180;
  const latitude2 = (to[0] * Math.PI) / 180;
  const longitudeDelta =
    ((to[1] - from[1]) * Math.PI) / 180;
  const y = Math.sin(longitudeDelta) * Math.cos(latitude2);
  const x =
    Math.cos(latitude1) * Math.sin(latitude2) -
    Math.sin(latitude1) *
      Math.cos(latitude2) *
      Math.cos(longitudeDelta);

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function nearestHeading(current: number, next: number): number {
  return current + ((next - current + 540) % 360) - 180;
}

function AnimatedVehicleMarker({
  vehicle,
}: {
  vehicle: LiveVehicle;
}) {
  const markerRef = useRef<L.Marker | null>(null);
  const coordinateRef = useRef<[number, number]>([
    vehicle.latitude,
    vehicle.longitude,
  ]);
  const headingRef = useRef(0);
  const recordedAtRef = useRef(
    vehicle.lastSeenAt
      ? new Date(vehicle.lastSeenAt).getTime()
      : Date.now(),
  );
  const animationFrameRef = useRef<number | null>(null);
  const colour = statusColour(vehicle.status, vehicle.isLive, vehicle.operationalStatus);
  const label =
    vehicle.driver?.callsign ||
    vehicle.callsign ||
    vehicle.externalId;
  const icon = useMemo(
    () => vehicleIcon(colour, label),
    [colour, label],
  );

  useEffect(() => {
    const marker = markerRef.current;

    if (!marker) {
      return;
    }

    const car = marker
      .getElement()
      ?.querySelector<HTMLElement>(".fleet-vehicle-car");
    const from: [number, number] = [
      coordinateRef.current[0],
      coordinateRef.current[1],
    ];
    const target: [number, number] = [
      vehicle.latitude,
      vehicle.longitude,
    ];
    const nextRecordedAt = vehicle.lastSeenAt
      ? new Date(vehicle.lastSeenAt).getTime()
      : Date.now();
    const timestampGap = Number.isFinite(nextRecordedAt)
      ? Math.abs(nextRecordedAt - recordedAtRef.current)
      : 1_200;
    recordedAtRef.current = Number.isFinite(nextRecordedAt)
      ? nextRecordedAt
      : Date.now();
    const moved =
      Math.abs(target[0] - from[0]) +
        Math.abs(target[1] - from[1]) >
      0.000001;

    if (!moved) {
      if (car) {
        car.style.transform = `rotate(${headingRef.current}deg)`;
      }
      return;
    }

    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
    }

    const duration = Math.max(
      800,
      Math.min(5_000, timestampGap * 0.92 || 1_200),
    );
    const fromHeading = headingRef.current;
    const toHeading = nearestHeading(
      fromHeading,
      movementBearing(from, target),
    );
    const startedAt = performance.now();

    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = progress * progress * (3 - 2 * progress);
      const coordinate: [number, number] = [
        from[0] + (target[0] - from[0]) * eased,
        from[1] + (target[1] - from[1]) * eased,
      ];

      coordinateRef.current = coordinate;
      marker.setLatLng(coordinate);
      headingRef.current =
        fromHeading + (toHeading - fromHeading) * eased;

      if (car) {
        car.style.transform = `rotate(${headingRef.current}deg)`;
      }

      animationFrameRef.current =
        progress < 1
          ? window.requestAnimationFrame(animate)
          : null;
    };

    animationFrameRef.current =
      window.requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [icon, vehicle.lastSeenAt, vehicle.latitude, vehicle.longitude]);

  return (
    <Marker
      ref={markerRef}
      position={coordinateRef.current}
      icon={icon}
    >
      <Tooltip
        direction="top"
        offset={[0, -18]}
        opacity={0.95}
        className="fleet-callsign-tooltip"
      >
        {label + " · " + vehicle.operationalStatus}
      </Tooltip>

      <Popup>
        <div className="min-w-56 text-sm">
          <p className="text-base font-bold">
            Driver {vehicle.driver?.callsign || vehicle.callsign || "—"}
          </p>

          <div className="mt-2 space-y-1">
            <p>
              <strong>Name:</strong>{" "}
              {vehicle.driver?.name || "Not available"}
            </p>
            <p>
              <strong>Today Revenue:</strong> £
              {(vehicle.driver?.todayRevenue ?? 0).toFixed(2)}
            </p>
            <p>
              <strong>Vehicle:</strong>{" "}
              {vehicle.registration || vehicle.callsign || vehicle.externalId}
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
            {vehicle.operationalStatus === "DOW" ||
            vehicle.operationalStatus === "DAP" ? (
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
              <strong>Booking:</strong> {vehicle.bookingId ?? "None"}
            </p>
            <p>
              <strong>Last update:</strong>{" "}
              {formatAge(vehicle.ageSeconds)}
            </p>
            <p>
              <strong>Connection:</strong>{" "}
              {vehicle.isLive ? "Live" : "Stale"}
            </p>
          </div>
        </div>
      </Popup>
    </Marker>
  );
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
  const mapFrameRef = useRef<HTMLDivElement>(null);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const fullscreen = nativeFullscreen || expanded;

  useEffect(() => {
    const syncFullscreen = () => {
      setNativeFullscreen(document.fullscreenElement === mapFrameRef.current);
    };
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const exitExpanded = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", exitExpanded);
    return () => window.removeEventListener("keydown", exitExpanded);
  }, [expanded]);

  async function toggleFullscreen() {
    const frame = mapFrameRef.current;
    if (!frame) return;
    if (expanded) {
      setExpanded(false);
      return;
    }
    if (document.fullscreenElement === frame) {
      await document.exitFullscreen();
      return;
    }
    try {
      if (!frame.requestFullscreen) {
        setExpanded(true);
        return;
      }
      await frame.requestFullscreen();
    } catch {
      setExpanded(true);
    }
  }

  const websocketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const fallbackIntervalRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const componentActiveRef = useRef(true);
  const fleetRequestInFlightRef = useRef(false);

  const loadFleet = useCallback(async () => {
    if (fleetRequestInFlightRef.current) return;
    fleetRequestInFlightRef.current = true;
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
      fleetRequestInFlightRef.current = false;
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

  const startFallbackPolling = useCallback((intervalMs = FALLBACK_POLL_INTERVAL_MS) => {
    if (fallbackIntervalRef.current !== null) {
      return;
    }

    void loadFleet();

    fallbackIntervalRef.current = window.setInterval(() => {
      void loadFleet();
    }, intervalMs);
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
          driver: incomingVehicle.driver
            ? {
                ...incomingVehicle.driver,
                todayRevenue:
                  incomingVehicle.driver.todayRevenue ??
                  (
                    existingVehicle?.driver?.externalId ===
                    incomingVehicle.driver.externalId
                      ? existingVehicle.driver.todayRevenue
                      : 0
                  ),
              }
            : null,
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
      // The socket can stay connected while updates are published by another
      // process. Reconcile with the canonical API even without socket events.
      startFallbackPolling(CONNECTED_POLL_INTERVAL_MS);
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
        stopFallbackPolling();
        startFallbackPolling();
      }
    });

    socket.addEventListener("close", () => {
      websocketRef.current = null;

      if (!componentActiveRef.current) {
        return;
      }

      setConnectionStatus("RECONNECTING");
      stopFallbackPolling();
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
        if (!vehicle.isLive && statusFilter !== "STALE") {
          return false;
        }

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "LIVE" && vehicle.isLive) ||
        (statusFilter === "STALE" && !vehicle.isLive) ||
        (statusFilter === "POB" && vehicle.operationalStatus === "POB") ||
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
            WebSocket updates with periodic refresh; five-second refresh while reconnecting
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

      {error && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {error} Existing positions may be out of date; the refresh will retry.
        </div>
      )}

      {summary.total > 0 && summary.live === 0 && (
        <div role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          No recent vehicle positions. The connection may be open, but the map has not received a position in the last two minutes. Select “Stale only” to view last known locations; they may no longer be accurate.
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

      {summary.stale > 0 && (
        <p className="text-xs text-slate-400">Available, busy and not working include last known statuses, including vehicles with stale positions.</p>
      )}

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
            <option value="POB">Passenger on board · All</option>
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

      <p className="text-xs text-slate-400">
        Map status: green = available · amber = on the way or arrived · red = passenger on board · grey = last known position
      </p>

      <div
        ref={mapFrameRef}
        className={`isolate overflow-hidden bg-slate-900 ${
          expanded
            ? "fixed inset-0 z-[1000] !m-0"
            : `relative ${nativeFullscreen ? "h-full w-full" : "h-[680px] rounded-2xl border border-slate-800"}`
        }`}
      >
        <button
          type="button"
          aria-pressed={fullscreen}
          onClick={() => void toggleFullscreen()}
          className="absolute right-3 top-3 z-[1000] rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-md hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
        >
          {fullscreen ? "Exit fullscreen" : "Fullscreen"}
        </button>
        <MapContainer
          center={PLYMOUTH_CENTER}
          zoom={CITY_CENTRE_ZOOM}
          scrollWheelZoom="center"
          zoomAnimation={false}
          className="h-full w-full"
        >
          <ResizeFleetMap />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <FitFleetBounds
            vehicles={filteredVehicles}
            fitRequestKey={mapFitRequestKey}
          />

          {filteredVehicles.map((vehicle) => (
            <AnimatedVehicleMarker
              key={vehicle.id}
              vehicle={vehicle}
            />
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
