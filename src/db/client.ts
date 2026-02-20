import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzleWs } from "drizzle-orm/neon-serverless";
import { log } from "@/lib/logger";
import * as schema from "./schema";

type HttpClient = ReturnType<typeof drizzleHttp<typeof schema>>;
type WsClient = ReturnType<typeof drizzleWs<typeof schema>>;

// undefined = not initialized, null = disabled, client = active
let httpClient: HttpClient | null | undefined;
let wsClient: WsClient | null | undefined;
let edgeWsUnavailable = false;

function isEdgeLikeRuntime(): boolean {
  const g = globalThis as {
    EdgeRuntime?: string;
    WebSocketPair?: unknown;
    navigator?: { userAgent?: string };
  };
  return (
    typeof g.EdgeRuntime === "string" ||
    typeof g.WebSocketPair === "function" ||
    g.navigator?.userAgent === "Cloudflare-Workers"
  );
}

function resolveWebSocketConstructor(): typeof WebSocket | undefined {
  const ws = (globalThis as { WebSocket?: typeof WebSocket }).WebSocket;
  return typeof ws === "function" ? ws : undefined;
}

function createDbWsClient(url: string): WsClient {
  const ws = resolveWebSocketConstructor();
  return drizzleWs({ connection: url, schema, ...(ws ? { ws } : {}) });
}

/** HTTP-backed Drizzle client — fast cold starts, used for all reads. */
export function getDb(): HttpClient | null {
  if (httpClient !== undefined) return httpClient;

  const url = process.env.POSTGRES_URL;
  if (!url) {
    log.info("db_disabled", { reason: "Missing POSTGRES_URL env var" });
    httpClient = null;
    return null;
  }

  try {
    httpClient = drizzleHttp(neon(url), { schema });
    log.info("db_http_enabled");
    return httpClient;
  } catch (err) {
    log.warn("db_http_init_failed", { error: (err as Error).message });
    httpClient = null;
    return null;
  }
}

/** WebSocket-backed Drizzle client — supports transactions, used for writes. */
export function getDbWs(): WsClient | null {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    log.info("db_disabled", { reason: "Missing POSTGRES_URL env var" });
    wsClient = null;
    return null;
  }

  // On edge runtimes (Cloudflare Workers), WebSocket-based Neon clients must
  // be created inside the request lifecycle and not reused across requests.
  if (isEdgeLikeRuntime()) {
    if (edgeWsUnavailable) return null;

    if (!resolveWebSocketConstructor()) {
      edgeWsUnavailable = true;
      log.warn("db_ws_unavailable", {
        reason: "Missing WebSocket constructor in edge runtime",
      });
      return null;
    }

    try {
      return createDbWsClient(url);
    } catch (err) {
      edgeWsUnavailable = true;
      log.warn("db_ws_init_failed", { error: (err as Error).message });
      return null;
    }
  }

  if (wsClient !== undefined) return wsClient;

  try {
    wsClient = createDbWsClient(url);
    log.info("db_ws_enabled");
    return wsClient;
  } catch (err) {
    log.warn("db_ws_init_failed", { error: (err as Error).message });
    wsClient = null;
    return null;
  }
}

/** Reset clients for testing — allows re-initialization after env var changes. */
export function _resetDbClient(): void {
  httpClient = undefined;
  wsClient = undefined;
  edgeWsUnavailable = false;
}
