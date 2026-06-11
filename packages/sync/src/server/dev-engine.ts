import { SyncBroker, type ISyncConnection } from "./broker.js";
import type { SyncHandler } from "./index.js";

const GLOBAL_KEY = "__sync_dev_broker__";

type DevBrokerState = {
  broker: SyncBroker;
};

let devBroker: SyncBroker | null = null;

export function setHandlers(handlers: SyncHandler[]) {
  const g = globalThis as unknown as Record<string, DevBrokerState | undefined>;
  if (!g[GLOBAL_KEY]) {
    const broker = new SyncBroker(handlers);
    g[GLOBAL_KEY] = { broker };
  } else {
    g[GLOBAL_KEY].broker.setHandlers(handlers);
  }
  devBroker = g[GLOBAL_KEY].broker;
}

function getDevBroker(): SyncBroker {
  if (devBroker) return devBroker;

  const g = globalThis as unknown as Record<string, DevBrokerState | undefined>;
  if (g[GLOBAL_KEY]) {
    devBroker = g[GLOBAL_KEY].broker;
    return devBroker!;
  }

  throw new Error("Sync dev broker not initialized. Call setHandlers first.");
}

export function addClient(ws: {
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
  on: (event: string, listener: (...args: any[]) => void) => void;
}) {
  const broker = getDevBroker();
  const subscribedChannels = new Set<string>();
  let auth: any = null;

  const conn: ISyncConnection = {
    send(data) {
      ws.send(data);
    },
    close(code, reason) {
      ws.close(code, reason);
    },
    getAuth() {
      return auth;
    },
    setAuth(newAuth) {
      auth = newAuth;
    },
    getSubscribedChannels() {
      return subscribedChannels;
    },
  };

  broker.registerConnection(conn);
  console.log("dev-engine: addClient registered connection");

  ws.on("message", async (data: any) => {
    const messageString = String(data);
    console.log("dev-engine: WebSocket message received:", messageString.slice(0, 100));
    const dummyRequest = new Request("http://localhost/api/sync");
    try {
      console.log("dev-engine: getting platform proxy...");
      const platform = await getPlatform();
      console.log("dev-engine: platform proxy obtained, handling message...");
      await broker.handleMessage(conn, messageString, platform, dummyRequest);
      console.log("dev-engine: message handled successfully");
    } catch (err) {
      console.error("dev-engine: Error handling message:", err);
    }
  });

  ws.on("close", () => {
    console.log("dev-engine: WebSocket connection closed");
    broker.removeConnection(conn);
  });

  ws.on("error", (err) => {
    console.error("dev-engine: WebSocket connection error:", err);
    broker.removeConnection(conn);
  });
}

const GLOBAL_PLATFORM_KEY = "__sync_dev_platform__";

type DevPlatformState = {
  platform: any;
};

async function getPlatform() {
  const g = globalThis as unknown as Record<string, DevPlatformState | undefined>;
  if (!g[GLOBAL_PLATFORM_KEY]) {
    try {
      console.log("dev-engine: calling getPlatformProxy()...");
      const startTime = Date.now();
      const { getPlatformProxy } = await import("wrangler");
      const platform = await getPlatformProxy();
      g[GLOBAL_PLATFORM_KEY] = { platform };
      console.log(`dev-engine: getPlatformProxy() succeeded in ${Date.now() - startTime}ms`);
    } catch (err) {
      console.error("dev-engine: Failed to load wrangler platform proxy:", err);
    }
  }
  return g[GLOBAL_PLATFORM_KEY]?.platform;
}

export async function broadcastExternalChange(
  channel: string,
  action: "create" | "update" | "delete",
  key: string | undefined,
  data: any,
) {
  const broker = getDevBroker();
  await broker.handleExternalChange(channel, action, key, data);
}
