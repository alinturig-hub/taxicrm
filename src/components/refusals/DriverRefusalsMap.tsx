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
import type { RefusalDetail } from "./RefusalMap";

const PLYMOUTH: [number, number] = [50.3755, -4.1427];

function pickupIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="width:24px;height:24px;border-radius:50%;background:#22c55e;border:2px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.4);font-size:13px">📍</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  });
}

function outcomeShort(d: RefusalDetail): string {
  if (d.outcome.completedAt) return "✅ efectuat";
  if (d.outcome.noFareAt) return "no-fare";
  if (d.outcome.cancelledAt) return "anulat";
  return "pierdut";
}

export default function DriverRefusalsMap({
  callsign,
  refusals,
}: {
  callsign: string;
  refusals: RefusalDetail[];
}) {
  const counts = {
    total: refusals.length,
    effected: refusals.filter((r) => r.outcome.completedAt).length,
    noFare: refusals.filter((r) => r.outcome.noFareAt).length,
    cancelled: refusals.filter((r) => r.outcome.cancelledAt).length,
    lost: refusals.filter(
      (r) => !r.outcome.completedAt && !r.outcome.noFareAt && !r.outcome.cancelledAt,
    ).length,
  };

  const withPos = refusals.filter(
    (r) => r.driverPosition && r.pickup,
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:grid-cols-5">
        {[
          ["Refuzuri", counts.total],
          ["Efectuate de alții", counts.effected],
          ["No-fare", counts.noFare],
          ["Anulate", counts.cancelled],
          ["Pierdute", counts.lost],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <MapContainer
          center={PLYMOUTH}
          zoom={11}
          scrollWheelZoom
          className="h-[620px] w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {withPos.map((r) => (
            <div key={r.bookingId}>
              <Polyline
                positions={[
                  [r.driverPosition!.lat, r.driverPosition!.lng],
                  [r.pickup!.lat, r.pickup!.lng],
                ]}
                pathOptions={{ color: "#ef4444", weight: 2, opacity: 0.55, dashArray: "5 5" }}
              />
              <Marker position={[r.pickup!.lat, r.pickup!.lng]} icon={pickupIcon()}>
                <Popup>
                  <strong>Pickup #{r.externalId}</strong>
                  {r.pickupAddress ? <div>{r.pickupAddress}</div> : null}
                  <div className="text-slate-500">
                    dist ${(r.distanceKm ?? 0).toFixed(2)} km · {outcomeShort(r)}
                  </div>
                </Popup>
              </Marker>
            </div>
          ))}
        </MapContainer>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Booking</th>
                <th className="px-4 py-3">Refuzat</th>
                <th className="px-4 py-3">Pickup</th>
                <th className="px-4 py-3">Distanță</th>
                <th className="px-4 py-3">Rezultat</th>
              </tr>
            </thead>
            <tbody>
              {refusals.map((r) => (
                <tr key={r.bookingId} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-semibold text-white">{r.externalId}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {r.refusedAt ? new Date(r.refusedAt).toLocaleString("ro-RO") : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {r.pickupZone || "—"}
                    <span className="ml-1 text-slate-500">{r.typeOfBooking}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {r.distanceKm != null ? `${r.distanceKm.toFixed(2)} km` : "—"}
                  </td>
                  <td className="px-4 py-3">{outcomeShort(r)}</td>
                </tr>
              ))}
              {refusals.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    Niciun refuz corelabil pentru #{callsign}.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
