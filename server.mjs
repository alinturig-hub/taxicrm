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

let driverSyncStartTimer = null;
let driverSyncCheckInterval = null;
let driverSyncCheckRunning = false;

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

server.listen(port, hostname, () => {
  console.log(`TaxiCRM ready on http://${hostname}:${port}`);
  console.log(`Fleet WebSocket ready on ws://${hostname}:${port}/ws/fleet`);

  startDriverRegistryScheduler();
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
