type TaxiCrmWebSocketBroadcast = (
  payload: unknown,
) => void;

declare global {
  // eslint-disable-next-line no-var
  var __taxiCrmWebSocketBroadcast:
    | TaxiCrmWebSocketBroadcast
    | undefined;
}

export type DashboardMetricUpdate = {
  date: string;
  revenue: number;
  cashRevenue: number;
  accountRevenue: number;
  cardRevenue: number;
  bookings: number;
  completed: number;
  cancelled: number;
  noFare: number;
  rejected: number;
  completionRate: number;
  updatedAt: string;
};

export function broadcastDashboardMetricUpdate(
  metric: DashboardMetricUpdate,
): boolean {
  const broadcast =
    globalThis.__taxiCrmWebSocketBroadcast;

  if (!broadcast) {
    return false;
  }

  broadcast({
    type: "dashboard.metrics.updated",
    sentAt: new Date().toISOString(),
    metric,
  });

  return true;
}
