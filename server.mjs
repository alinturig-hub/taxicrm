import { createServer } from "node:http";
import next from "next";
import { WebSocket, WebSocketServer } from "ws";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number.parseInt(process.env.PORT || "3000", 10);

const DRIVER_SYNC_START_DELAY_MS =
  60 * 1000;
const DRIVER_SYNC_CHECK_INTERVAL_MS =
  60 * 60 * 1000;
const CUSTOMER_INTELLIGENCE_START_DELAY_MS =
  5 * 60 * 1000;
const CUSTOMER_INTELLIGENCE_INTERVAL_MS =
  12 * 60 * 60 * 1000;

const PROFILE_SNAPSHOTS_START_DELAY_MS =
  15 * 60 * 1000;
const PROFILE_SNAPSHOTS_INTERVAL_MS =
  6 * 60 * 60 * 1000;
const DEMAND_FORECAST_START_DELAY_MS =
  10 * 60 * 1000;
const DEMAND_FORECAST_INTERVAL_MS =
  12 * 60 * 60 * 1000;
const PREDICTION_MAINT_START_DELAY_MS =
  20 * 60 * 1000;
const PREDICTION_MAINT_INTERVAL_MS =
  6 * 60 * 60 * 1000;
const GEOAPIFY_BACKFILL_START_DELAY_MS =
  25 * 60 * 1000;
const GEOAPIFY_BACKFILL_INTERVAL_MS =
  6 * 60 * 60 * 1000;
const BATCH_DRAIN_DELAY_MS =
  5 * 1000;
const MAX_DRAIN_BATCHES =
  300;

let driverSyncStartTimer = null;
let driverSyncCheckInterval = null;
let driverSyncCheckRunning = false;
let customerIntelligenceStartTimer = null;
let customerIntelligenceInterval = null;
let customerIntelligenceRunning = false;

const profileSnapshotsState = {
  startTimer: null,
  interval: null,
  running: false,
};
const demandForecastState = {
  startTimer: null,
  interval: null,
  running: false,
};
const predictionMaintState = {
  startTimer: null,
  interval: null,
  running: false,
};
const geoapifyBackfillState = {
  startTimer: null,
  interval: null,
  running: false,
};

const app = next({
  dev,
  hostname,
  port,
});

const handle = app.getRequestHandler();

await app.prepare();

const server = createServer((request, response) => {
  handle(request, response);
});

const webSocketServer = new WebSocketServer({
  noServer: true,
});

const clients = new Set();

function sendJson(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(payload));
}

function broadcast(payload) {
  const message = JSON.stringify(payload);

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

globalThis.__taxiCrmWebSocketBroadcast = broadcast;

webSocketServer.on("connection", (socket, request) => {
  clients.add(socket);

  socket.isAlive = true;

  sendJson(socket, {
    type: "connection.ready",
    connectedAt: new Date().toISOString(),
  });

  socket.on("pong", () => {
    socket.isAlive = true;
  });

  socket.on("message", (rawMessage) => {
    try {
      const message = JSON.parse(rawMessage.toString());

      if (message?.type === "ping") {
        sendJson(socket, {
          type: "pong",
          sentAt: new Date().toISOString(),
        });
      }
    } catch {
      sendJson(socket, {
        type: "error",
        code: "INVALID_MESSAGE",
        message: "WebSocket message must be valid JSON.",
      });
    }
  });

  socket.on("close", () => {
    clients.delete(socket);
  });

  socket.on("error", (error) => {
    console.error("WebSocket client error:", error);
    clients.delete(socket);
  });

  console.log(
    `WebSocket client connected: ${request.socket.remoteAddress || "unknown"}`,
  );
});

server.on("upgrade", (request, socket, head) => {
  const requestUrl = new URL(
    request.url || "/",
    `http://${request.headers.host || "localhost"}`,
  );

  if (requestUrl.pathname !== "/ws/fleet") {
    socket.destroy();
    return;
  }

  webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
    webSocketServer.emit("connection", webSocket, request);
  });
});

const heartbeatInterval = setInterval(() => {
  for (const client of clients) {
    if (client.isAlive === false) {
      clients.delete(client);
      client.terminate();
      continue;
    }

    client.isAlive = false;
    client.ping();
  }
}, 30_000);

server.on("close", () => {
  clearInterval(heartbeatInterval);

  if (driverSyncStartTimer) {
    clearTimeout(
      driverSyncStartTimer,
    );
  }

  if (driverSyncCheckInterval) {
    clearInterval(
      driverSyncCheckInterval,
    );
  }

  if (customerIntelligenceStartTimer) {
    clearTimeout(
      customerIntelligenceStartTimer,
    );
  }

  if (customerIntelligenceInterval) {
    clearInterval(
      customerIntelligenceInterval,
    );
  }

  for (const state of [
    profileSnapshotsState,
    demandForecastState,
    predictionMaintState,
    geoapifyBackfillState,
  ]) {
    if (state.startTimer) {
      clearTimeout(state.startTimer);
    }

    if (state.interval) {
      clearInterval(state.interval);
    }
  }
});

async function checkDriverRegistrySync() {
  if (driverSyncCheckRunning) {
    return;
  }

  const cronSecret =
    process.env.CRON_SECRET;

  if (!cronSecret) {
    console.warn(
      "Driver registry scheduler disabled: CRON_SECRET is not configured.",
    );
    return;
  }

  driverSyncCheckRunning = true;

  try {
    const response = await fetch(
      `http://127.0.0.1:${port}/api/internal/driver-registry-sync`,
      {
        method: "POST",
        headers: {
          "content-type":
            "application/json",
          "x-cron-secret":
            cronSecret,
        },
        body:
          "{}",
      },
    );

    const payload =
      await response.json();

    if (!response.ok) {
      throw new Error(
        payload.message ||
          payload.error ||
          `HTTP ${response.status}`,
      );
    }

    if (
      payload.status !==
        "NOT_DUE" &&
      payload.status !==
        "DISABLED"
    ) {
      console.log(
        "Automatic driver registry sync completed:",
        {
          status:
            payload.status,
          drivers:
            payload.drivers,
        },
      );
    }
  } catch (error) {
    console.error(
      "Automatic driver registry sync check failed:",
      error,
    );
  } finally {
    driverSyncCheckRunning = false;
  }
}

function startDriverRegistryScheduler() {
  driverSyncStartTimer =
    setTimeout(() => {
      void checkDriverRegistrySync();
    }, DRIVER_SYNC_START_DELAY_MS);

  driverSyncCheckInterval =
    setInterval(() => {
      void checkDriverRegistrySync();
    }, DRIVER_SYNC_CHECK_INTERVAL_MS);

  driverSyncStartTimer.unref();
  driverSyncCheckInterval.unref();

  console.log(
    "Driver registry scheduler ready: checks hourly and syncs when due.",
  );
}

async function refreshCustomerIntelligence() {
  if (customerIntelligenceRunning) {
    return;
  }

  const cronSecret =
    process.env.CRON_SECRET;

  if (!cronSecret) {
    console.warn(
      "Customer intelligence scheduler disabled: CRON_SECRET is not configured.",
    );
    return;
  }

  customerIntelligenceRunning = true;

  try {
    const response = await fetch(
      `http://127.0.0.1:${port}/api/internal/customer-intelligence-refresh`,
      {
        method: "POST",
        headers: {
          "content-type":
            "application/json",
          "x-cron-secret":
            cronSecret,
        },
        body: "{}",
      },
    );

    const payload =
      await response.json();

    if (!response.ok) {
      throw new Error(
        payload.message ||
          payload.error ||
          `HTTP ${response.status}`,
      );
    }

    console.log(
      "Automatic customer intelligence refresh completed:",
      {
        status:
          payload.status,
        places:
          payload.places,
        customerTags:
          payload.customerTags,
      },
    );
  } catch (error) {
    console.error(
      "Automatic customer intelligence refresh failed:",
      error,
    );
  } finally {
    customerIntelligenceRunning = false;
  }
}

function startCustomerIntelligenceScheduler() {
  customerIntelligenceStartTimer =
    setTimeout(() => {
      void refreshCustomerIntelligence();
    }, CUSTOMER_INTELLIGENCE_START_DELAY_MS);

  customerIntelligenceInterval =
    setInterval(() => {
      void refreshCustomerIntelligence();
    }, CUSTOMER_INTELLIGENCE_INTERVAL_MS);

  customerIntelligenceStartTimer.unref();
  customerIntelligenceInterval.unref();

  console.log(
    "Customer intelligence scheduler ready: refreshes every 12 hours.",
  );
}

async function postInternalJob(path, body) {
  const cronSecret =
    process.env.CRON_SECRET;

  if (!cronSecret) {
    console.warn(
      `Scheduler disabled for ${path}: CRON_SECRET is not configured.`,
    );
    return null;
  }

  const response = await fetch(
    `http://127.0.0.1:${port}${path}`,
    {
      method: "POST",
      headers: {
        "content-type":
          "application/json",
        "x-cron-secret":
          cronSecret,
      },
      body: JSON.stringify(body),
    },
  );

  const payload =
    await response.json();

  if (!response.ok) {
    throw new Error(
      payload.message ||
        payload.error ||
        `HTTP ${response.status}`,
    );
  }

  return payload;
}

async function runDrainingJob(
  name,
  path,
  body,
  state,
) {
  if (state.running) {
    return;
  }

  state.running = true;

  try {
    let batches = 0;
    let hasMore = true;

    while (
      hasMore &&
      batches < MAX_DRAIN_BATCHES
    ) {
      const payload = await postInternalJob(
        path,
        body,
      );

      if (payload === null) {
        return;
      }

      hasMore = payload.hasMore === true;
      batches += 1;

      if (hasMore) {
        await new Promise((resolve) => {
          setTimeout(
            resolve,
            BATCH_DRAIN_DELAY_MS,
          );
        });
      }
    }

    console.log(
      `${name} completed (${batches} batch(es)).`,
    );
  } catch (error) {
    console.error(
      `${name} failed:`,
      error,
    );
  } finally {
    state.running = false;
  }
}

async function runSingleJob(
  name,
  path,
  body,
  state,
) {
  if (state.running) {
    return;
  }

  state.running = true;

  try {
    await postInternalJob(path, body);
    console.log(`${name} completed.`);
  } catch (error) {
    console.error(
      `${name} failed:`,
      error,
    );
  } finally {
    state.running = false;
  }
}

function scheduleJob({
  name,
  path,
  body,
  state,
  startDelayMs,
  intervalMs,
  drain,
}) {
  const run = drain
    ? () =>
        void runDrainingJob(
          name,
          path,
          body,
          state,
        )
    : () =>
        void runSingleJob(
          name,
          path,
          body,
          state,
        );

  state.startTimer = setTimeout(
    run,
    startDelayMs,
  );
  state.interval = setInterval(
    run,
    intervalMs,
  );

  state.startTimer.unref();
  state.interval.unref();

  console.log(
    `${name} scheduler ready.`,
  );
}

server.listen(port, hostname, () => {
  console.log(`TaxiCRM ready on http://${hostname}:${port}`);
  console.log(`Fleet WebSocket ready on ws://${hostname}:${port}/ws/fleet`);

  startDriverRegistryScheduler();
  startCustomerIntelligenceScheduler();

  scheduleJob({
    name: "Customer profile snapshots",
    path: "/api/internal/customer-profile-snapshots",
    body: { limit: 50 },
    state: profileSnapshotsState,
    startDelayMs: PROFILE_SNAPSHOTS_START_DELAY_MS,
    intervalMs: PROFILE_SNAPSHOTS_INTERVAL_MS,
    drain: true,
  });

  scheduleJob({
    name: "Booking demand forecast",
    path: "/api/internal/booking-demand-forecast",
    body: {},
    state: demandForecastState,
    startDelayMs: DEMAND_FORECAST_START_DELAY_MS,
    intervalMs: DEMAND_FORECAST_INTERVAL_MS,
    drain: false,
  });

  scheduleJob({
    name: "Customer booking prediction maintenance",
    path: "/api/internal/customer-booking-predictions",
    body: { limit: 50 },
    state: predictionMaintState,
    startDelayMs: PREDICTION_MAINT_START_DELAY_MS,
    intervalMs: PREDICTION_MAINT_INTERVAL_MS,
    drain: true,
  });

  scheduleJob({
    name: "Geoapify historical place backfill",
    path: "/api/dashboard/integrations/geoapify/enrich",
    body: {
      limit: 100,
      scope: "HISTORICAL",
      dailyCreditCeiling: 2000,
    },
    state: geoapifyBackfillState,
    startDelayMs: GEOAPIFY_BACKFILL_START_DELAY_MS,
    intervalMs: GEOAPIFY_BACKFILL_INTERVAL_MS,
    drain: true,
  });
});

function shutdown(signal) {
  console.log(`${signal} received. Shutting down TaxiCRM.`);

  broadcast({
    type: "server.shutdown",
    sentAt: new Date().toISOString(),
  });

  for (const client of clients) {
    client.close(1001, "Server shutting down");
  }

  webSocketServer.close();

  server.close(() => {
    process.exit(0);
  });

  setTimeout(() => {
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
