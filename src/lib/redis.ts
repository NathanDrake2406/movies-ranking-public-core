import { Redis } from "@upstash/redis";
import { log } from "./logger";

// ─── Shared Redis client (lazy singleton) ────────────────────────────────────
//
// All KV modules (kv.ts, kv-wikidata.ts, queries-kv.ts) share this single
// client instance — one initialization, one log message, one diagnosis point.

let redisClient: Redis | null | undefined; // undefined = not initialized

export function getRedisClient(): Redis | null {
  if (redisClient !== undefined) return redisClient;

  // Support both Vercel-provisioned (KV_REST_API_*) and native Upstash (UPSTASH_REDIS_REST_*) names
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    log.info("kv_disabled", { reason: "Missing Redis env vars" });
    redisClient = null;
    return null;
  }

  try {
    redisClient = new Redis({ url, token });
    log.info("kv_enabled");
    return redisClient;
  } catch (err) {
    log.warn("kv_init_failed", { error: (err as Error).message });
    redisClient = null;
    return null;
  }
}

/** Reset for testing — forces re-initialization on next call. */
export function _resetRedisClient(): void {
  redisClient = undefined;
}
