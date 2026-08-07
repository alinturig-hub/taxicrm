export type OsrmRoute = {
  distanceMetres: number;
  durationSeconds: number;
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
};

type OsrmResponse = {
  code?: string;
  routes?: Array<{
    distance?: number;
    duration?: number;
    geometry?: {
      type?: string;
      coordinates?: [number, number][];
    };
  }>;
};

const OSRM_BASE_URL =
  process.env.OSRM_BASE_URL ?? "https://router.project-osrm.org";

export async function getDrivingRoute(params: {
  fromLatitude: number;
  fromLongitude: number;
  toLatitude: number;
  toLongitude: number;
}): Promise<OsrmRoute | null> {
  const {
    fromLatitude,
    fromLongitude,
    toLatitude,
    toLongitude,
  } = params;

  const coordinates =
    `${fromLongitude},${fromLatitude};` +
    `${toLongitude},${toLatitude}`;

  const url =
    `${OSRM_BASE_URL}/route/v1/driving/${coordinates}` +
    "?overview=full&geometries=geojson";

  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as OsrmResponse;

  if (
    payload.code !== "Ok" ||
    !payload.routes?.length
  ) {
    return null;
  }

  const route = payload.routes[0];

  if (
    typeof route.distance !== "number" ||
    typeof route.duration !== "number" ||
    route.geometry?.type !== "LineString" ||
    !Array.isArray(route.geometry.coordinates)
  ) {
    return null;
  }

  return {
    distanceMetres: route.distance,
    durationSeconds: route.duration,
    geometry: {
      type: "LineString",
      coordinates: route.geometry.coordinates,
    },
  };
}
