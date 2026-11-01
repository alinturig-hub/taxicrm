"use client";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";
import { latLngBounds } from "leaflet";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Tooltip,
  useMap,
} from "react-leaflet";
import type { Area } from "@/lib/analytics/explorer/model";
function FitAreas({ points }: { points: Area[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length)
      map.fitBounds(
        latLngBounds(
          points.map((p) => [p.latitude!, p.longitude!] as [number, number]),
        ),
        { padding: [30, 30], maxZoom: 12, animate: false },
      );
  }, [map, points]);
  return null;
}
export default function AreaHeatMap({ areas }: { areas: Area[] }) {
  const points = useMemo(
    () =>
      areas.filter(
        (a) =>
          a.key !== "UNKNOWN" &&
          a.latitude !== null &&
          a.longitude !== null &&
          Number.isFinite(a.latitude) &&
          Number.isFinite(a.longitude) &&
          Math.abs(a.latitude) <= 90 &&
          Math.abs(a.longitude) <= 180 &&
          (a.latitude !== 0 || a.longitude !== 0),
      ),
    [areas],
  );
  const max = Math.max(1, ...points.map((a) => a.total));
  return (
    <div className="relative overflow-hidden rounded-xl border border-app-border">
      <MapContainer
        center={[50.3755, -4.1427]}
        zoom={11}
        scrollWheelZoom={false}
        style={{ height: 360, width: "100%", zIndex: 0 }}
      >
        <FitAreas points={points} />
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.map((a) => (
          <CircleMarker
            key={a.key}
            center={[a.latitude!, a.longitude!]}
            radius={6 + 22 * Math.sqrt(a.total / max)}
            pathOptions={{
              color: "#fb923c",
              weight: 1,
              fillColor: a.total / max > 0.6 ? "#ea580c" : "#2dd4bf",
              fillOpacity: 0.3 + (0.45 * a.total) / max,
            }}
          >
            <Tooltip>
              <strong>{a.name}</strong>
              <br />
              {a.total.toLocaleString("en-GB")} bookings
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
      {!points.length && (
        <p className="absolute bottom-3 left-3 right-3 rounded-lg bg-surface p-3 text-sm">
          No verified zone centres in this selection.
        </p>
      )}
      <p className="bg-surface px-4 py-3 text-xs text-app-muted">
        Zone-centre intensity, not individual journeys or live cars.{" "}
        {points.length} mapped zones. Map tiles by OpenStreetMap.
      </p>
    </div>
  );
}
