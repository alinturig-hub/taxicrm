import { createServer } from "node:http";
import next from "next";
import { WebSocket, WebSocketServer } from "ws";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number.parseInt(process.env.PORT || "3000", 10);

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
});

server.listen(port, hostname, () => {
  console.log(`TaxiCRM ready on http://${hostname}:${port}`);
  console.log(`Fleet WebSocket ready on ws://${hostname}:${port}/ws/fleet`);
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
