"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
} from "react-leaflet";

type Point = { lat: number; lng: number };

export type RefusalDetail = {
  bookingId: string;
  externalId: string;
  status: string;
  typeOfBooking: string | null;
  bookingSource: string | null;
  accountName: string | null;
  customerName: string | null;
  telephoneNumber: string | null;
  pickup: Point | null;
  pickupAddress: string | null;
  pickupZone: string | null;
  driver: { callsign: string; name: string | null } | null;
  driverPosition: Point | null;
  driverPositionAt: string | null;
  refusedAt: string | null;
  deltaSeconds: number | null;
  distanceKm: number | null;
  outcome: {
    completedAt: string | null;
    noFareAt: string | null;
    cancelledAt: string | null;
  };
};

const PLYMOUTH: [number, number] = [50.3755, -4.1427];

function driverIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="width:34px;height:34px;border-radius:50%;background:#ef4444;border:3px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.45);font-size:17px">🚙</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}

function pickupIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="width:34px;height:34px;border-radius:50%;background:#22c55e;border:3px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.45);font-size:17px">📍</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}

function outcomeLabel(d: RefusalDetail): string {
  if (d.outcome.completedAt) return "Completed by another driver ✅";
  if (d.outcome.noFareAt) return "No fare (customer absent)";
  if (d.outcome.cancelledAt) return "Cancelled";
  return "Lost (no outcome)";
}

function fmtDelta(sec: number | null): string {
  if (sec === null) return "—";
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.round(sec / 60);
  return `${m}m`;
}

export default function RefusalMap({
  detail,
}: {
  detail: RefusalDetail;
}) {
  const positions: [number, number][] = [];
  if (detail.driverPosition) positions.push([detail.driverPosition.lat, detail.driverPosition.lng]);
  if (detail.pickup) positions.push([detail.pickup.lat, detail.pickup.lng]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Booking", detail.externalId],
          ["Driver (refused)", detail.driver ? `#${detail.driver.callsign}` : "—"],
          ["Driver-to-pickup distance", detail.distanceKm != null ? `${detail.distanceKm.toFixed(2)} km` : "—"],
          ["Snapshot time offset", fmtDelta(detail.deltaSeconds)],
          ["Outcome", outcomeLabel(detail)],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-1 text-sm font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <MapContainer
          center={positions.length ? positions[0] : PLYMOUTH}
          zoom={positions.length ? 12 : 11}
          scrollWheelZoom
          className="h-[620px] w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {positions.length === 1 ? (
            <Marker position={positions[0]} icon={pickupIcon()}>
              <Popup>{detail.pickupAddress || "Pickup"}</Popup>
            </Marker>
          ) : null}

          {detail.pickup && detail.driverPosition ? (
            <Polyline
              positions={[
                [detail.driverPosition.lat, detail.driverPosition.lng],
                [detail.pickup.lat, detail.pickup.lng],
              ]}
              pathOptions={{ color: "#ef4444", weight: 3, opacity: 0.75, dashArray: "6 6" }}
            />
          ) : null}

          {detail.driverPosition ? (
            <Marker
              position={[detail.driverPosition.lat, detail.driverPosition.lng]}
              icon={driverIcon()}
            >
              <Popup>
                <strong>Driver {detail.driver ? `#${detail.driver.callsign}` : ""}</strong>
                {detail.driver?.name ? <div>{detail.driver.name}</div> : null}
                <div>Location at the time of refusal</div>
              </Popup>
            </Marker>
          ) : null}

          {detail.pickup ? (
            <Marker position={[detail.pickup.lat, detail.pickup.lng]} icon={pickupIcon()}>
              <Popup>
                <strong>Offered pickup</strong>
                {detail.pickupAddress ? <div>{detail.pickupAddress}</div> : null}
                {detail.pickupZone ? <div className="text-slate-500">{detail.pickupZone}</div> : null}
              </Popup>
            </Marker>
          ) : null}
        </MapContainer>
      </div>

      {detail.driver?.name ? (
        <p className="text-sm text-slate-500">
          Driver: <strong className="text-white">{detail.driver.name}</strong>
          {detail.customerName ? ` · Customer: ${detail.customerName}` : ""}
          {detail.typeOfBooking ? ` · ${detail.typeOfBooking}` : ""}
        </p>
      ) : null}
    </div>
  );
}
