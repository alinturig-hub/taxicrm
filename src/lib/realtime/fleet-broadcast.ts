export type FleetDriverUpdate = {
  id: string;
  externalId: string;
  callsign: string | null;
  name: string | null;
  badgeNumber: string | null;
};

export type FleetVehicleUpdate = {
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
  driver: FleetDriverUpdate | null;
};

type TaxiCrmWebSocketBroadcast = (payload: unknown) => void;

declare global {
  // eslint-disable-next-line no-var
  var __taxiCrmWebSocketBroadcast:
    | TaxiCrmWebSocketBroadcast
    | undefined;
}

export function broadcastFleetVehicleUpdate(
  vehicle: FleetVehicleUpdate,
): boolean {
  const broadcast = globalThis.__taxiCrmWebSocketBroadcast;

  if (!broadcast) {
    return false;
  }

  broadcast({
    type: "fleet.vehicle.updated",
    sentAt: new Date().toISOString(),
    vehicle,
  });

  return true;
}
