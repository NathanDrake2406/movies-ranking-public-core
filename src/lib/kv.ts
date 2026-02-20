import { getRedisClient } from "./redis";
import { log } from "./logger";
import type { ScorePayload } from "./types";

// ─── TTL computation (pure) ──────────────────────────────────────────────────

const THREE_HOURS_SEC = 3 * 60 * 60;
const ONE_DAY_SEC = 24 * 60 * 60;
const SIXTY_DAYS_SEC = 60 * 24 * 60 * 60;
const FOUR_MONTHS_MS = 4 * 30 * 24 * 60 * 60 * 1000;
const ONE_YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

export function computeKvTtl(
  releaseDate: string | undefined,
  movieYear: string | undefined,
  now: Date = new Date(),
): number | null {
  // Prefer exact release date for precise age calculation
  if (releaseDate) {
    const released = new Date(releaseDate);
    if (!isNaN(released.getTime())) {
      const ageMs = now.getTime() - released.getTime();
      if (ageMs < FOUR_MONTHS_MS) return THREE_HOURS_SEC;
      if (ageMs < ONE_YEAR_MS) return ONE_DAY_SEC;
      return SIXTY_DAYS_SEC;
    }
  }

  // Fallback to year-only
  if (!movieYear) return null;
  const year = parseInt(movieYear, 10);
  if (isNaN(year)) return null;

  const age = now.getFullYear() - year;
  if (age < 1) return THREE_HOURS_SEC;
  if (age < 2) return ONE_DAY_SEC;
  return SIXTY_DAYS_SEC;
}

// ─── Public API (gracefully degrading) ───────────────────────────────────────

// Bump when ScorePayload shape changes to auto-invalidate stale cache entries
const KV_SCHEMA_VERSION = 2;

type CachedPayload = ScorePayload & { _v: number };

function kvKey(imdbId: string): string {
  return `score:${imdbId}`;
}

export async function kvGet(imdbId: string): Promise<ScorePayload | null> {
  try {
    const client = getRedisClient();
    if (!client) return null;
    const data = await client.get<CachedPayload>(kvKey(imdbId));
    if (data && data._v === KV_SCHEMA_VERSION) {
      log.info("kv_hit", { imdbId });
      const { _v, ...payload } = data;
      return payload;
    }
    return null;
  } catch (err) {
    log.warn("kv_get_failed", { imdbId, error: (err as Error).message });
    return null;
  }
}

export async function kvSet(
  imdbId: string,
  payload: ScorePayload,
  releaseDate: string | undefined,
  movieYear: string | undefined,
): Promise<void> {
  try {
    const ttl = computeKvTtl(releaseDate, movieYear);
    if (ttl === null) return;
    const client = getRedisClient();
    if (!client) return;
    const cached: CachedPayload = { ...payload, _v: KV_SCHEMA_VERSION };
    await client.set(kvKey(imdbId), cached, { ex: ttl });
    log.info("kv_set", { imdbId, ttlSec: ttl });
  } catch (err) {
    log.warn("kv_set_failed", { imdbId, error: (err as Error).message });
  }
}

// ─── Search cache (shared across instances via KV) ──────────────────────────

const SEARCH_TTL_SEC = 24 * 60 * 60; // 24 hours — TMDB results don't change fast

function searchKey(query: string, year: number | null): string {
  return `search:${query.toLowerCase()}|${year ?? ""}`;
}

export async function kvSearchGet<T>(
  query: string,
  year: number | null,
): Promise<T[] | null> {
  try {
    const client = getRedisClient();
    if (!client) return null;
    const data = await client.get<T[]>(searchKey(query, year));
    if (data) {
      log.info("kv_search_hit", { query });
      return data;
    }
    return null;
  } catch (err) {
    log.warn("kv_search_get_failed", {
      query,
      error: (err as Error).message,
    });
    return null;
  }
}

export async function kvSearchSet<T>(
  query: string,
  year: number | null,
  results: T[],
): Promise<void> {
  try {
    const client = getRedisClient();
    if (!client) return;
    await client.set(searchKey(query, year), results, { ex: SEARCH_TTL_SEC });
    log.info("kv_search_set", { query, count: results.length });
  } catch (err) {
    log.warn("kv_search_set_failed", {
      query,
      error: (err as Error).message,
    });
  }
}

// ─── Theme summary cache ────────────────────────────────────────────────────

const THEME_TTL_SEC = 90 * 24 * 60 * 60; // 90 days — AI summaries rarely change

function themeKey(imdbId: string, themeId: string): string {
  return `theme:${imdbId}:${themeId}`;
}

export async function kvThemeGet(
  imdbId: string,
  themeId: string,
): Promise<string | null> {
  try {
    const client = getRedisClient();
    if (!client) return null;
    const data = await client.get<string>(themeKey(imdbId, themeId));
    if (data) {
      log.info("kv_theme_hit", { imdbId, themeId });
      return data;
    }
    return null;
  } catch (err) {
    log.warn("kv_theme_get_failed", {
      imdbId,
      themeId,
      error: (err as Error).message,
    });
    return null;
  }
}

export async function kvThemeSet(
  imdbId: string,
  themeId: string,
  summary: string,
): Promise<void> {
  try {
    const client = getRedisClient();
    if (!client) return;
    await client.set(themeKey(imdbId, themeId), summary, { ex: THEME_TTL_SEC });
    log.info("kv_theme_set", { imdbId, themeId });
  } catch (err) {
    log.warn("kv_theme_set_failed", {
      imdbId,
      themeId,
      error: (err as Error).message,
    });
  }
}

export { _resetRedisClient as _resetKvClient } from "./redis";
