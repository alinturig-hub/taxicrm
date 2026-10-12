const busyStatuses = new Set([
  "Busy",
  "BusyMeterOff",
  "BusyMeterOffAccount",
  "BusyMeterOnFromClear",
  "BusyMeterOnFromMeterOffCash",
  "BusyMeterOnFromMeterOffAccount",
]);
export type PresenceVehicle = {
  id: string;
  currentDriverId: string | null;
  currentStatus: string | null;
  lastSeenAt: Date | null;
};
export type PresenceShift = {
  driverId: string;
  vehicleId: string | null;
  status: string;
  startedAt: Date;
  endedAt: Date | null;
};
export function fleetPresence(vehicles: PresenceVehicle[], now: Date) {
  const summary = {
    totalTracked: vehicles.length,
    live: 0,
    stale: 0,
    clear: 0,
    busy: 0,
    notWorking: 0,
    unknown: 0,
  };
  for (const vehicle of vehicles) {
    if (!isRecent(vehicle, now)) {
      summary.stale++;
      continue;
    }
    summary.live++;
    if (vehicle.currentStatus === "Clear") summary.clear++;
    else if (vehicle.currentStatus === "NotWorking") summary.notWorking++;
    else if (busyStatuses.has(vehicle.currentStatus ?? "")) summary.busy++;
    else summary.unknown++;
  }
  return summary;
}
export function isRecent(vehicle: PresenceVehicle, now: Date) {
  return Boolean(
    vehicle.lastSeenAt &&
      vehicle.lastSeenAt.getTime() >= now.getTime() - 120000 &&
      vehicle.lastSeenAt <= now,
  );
}
export function driverPresence(
  shifts: PresenceShift[],
  vehicles: PresenceVehicle[],
  now: Date,
) {
  // Resolve latest shift across every status before considering an older ACTIVE row.
  const latest = new Map<string, PresenceShift>();
  for (const shift of shifts) {
    if (shift.startedAt > now) continue;
    const old = latest.get(shift.driverId);
    if (
      !old ||
      shift.startedAt > old.startedAt ||
      (shift.startedAt.getTime() === old.startedAt.getTime() &&
        shift.status === "ENDED")
    )
      latest.set(shift.driverId, shift);
  }
  const open = Array.from(latest.values()).filter(
    (shift) => shift.status === "ACTIVE" && shift.endedAt === null,
  );
  const verified = new Set<string>();
  for (const vehicle of vehicles) {
    if (
      !isRecent(vehicle, now) ||
      !(
        vehicle.currentStatus === "Clear" ||
        busyStatuses.has(vehicle.currentStatus ?? "")
      )
    )
      continue;
    const shift = vehicle.currentDriverId
      ? latest.get(vehicle.currentDriverId)
      : undefined;
    if (
      shift?.status === "ACTIVE" &&
      shift.endedAt === null &&
      shift.vehicleId === vehicle.id
    )
      verified.add(shift.driverId);
  }
  const withVehicle = open.filter((shift) => shift.vehicleId !== null).length;
  return {
    onShift: open.length,
    offShift: Array.from(latest.values()).filter(
      (shift) => shift.status === "ENDED",
    ).length,
    withVehicle,
    withoutVehicle: open.length - withVehicle,
    liveConfirmed: verified.size,
    unconfirmedOpen: open.length - verified.size,
  };
}
