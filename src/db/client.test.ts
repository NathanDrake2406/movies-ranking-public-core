import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => vi.fn()),
}));

vi.mock("drizzle-orm/neon-http", () => ({
  drizzle: vi.fn(() => ({ __mock: "http" })),
}));

vi.mock("drizzle-orm/neon-serverless", () => ({
  drizzle: vi.fn(() => ({ __mock: "ws" })),
}));

import { getDb, getDbWs, _resetDbClient } from "./client";

const originalEnv = process.env.POSTGRES_URL;
const originalEdgeRuntime = (globalThis as { EdgeRuntime?: string })
  .EdgeRuntime;
const originalWebSocket = (globalThis as { WebSocket?: typeof WebSocket })
  .WebSocket;

beforeEach(() => {
  vi.clearAllMocks();
  _resetDbClient();
  delete process.env.POSTGRES_URL;
  delete (globalThis as { EdgeRuntime?: string }).EdgeRuntime;
});

afterEach(() => {
  _resetDbClient();
  if (originalEnv !== undefined) {
    process.env.POSTGRES_URL = originalEnv;
  } else {
    delete process.env.POSTGRES_URL;
  }
  if (originalEdgeRuntime !== undefined) {
    (globalThis as { EdgeRuntime?: string }).EdgeRuntime = originalEdgeRuntime;
  } else {
    delete (globalThis as { EdgeRuntime?: string }).EdgeRuntime;
  }
  if (originalWebSocket !== undefined) {
    (globalThis as { WebSocket?: typeof WebSocket }).WebSocket =
      originalWebSocket;
  } else {
    delete (globalThis as { WebSocket?: typeof WebSocket }).WebSocket;
  }
});

describe("getDb (HTTP)", () => {
  it("returns null when POSTGRES_URL is unset", () => {
    expect(getDb()).toBeNull();
  });

  it("returns an HTTP client when POSTGRES_URL is configured", () => {
    process.env.POSTGRES_URL = "postgresql://localhost:5432/test";
    const db = getDb();
    expect(db).not.toBeNull();
    expect(db).toHaveProperty("__mock", "http");
  });

  it("returns the same instance on repeated calls (singleton)", () => {
    process.env.POSTGRES_URL = "postgresql://localhost:5432/test";
    const db1 = getDb();
    const db2 = getDb();
    expect(db1).toBe(db2);
  });

  it("re-initializes after _resetDbClient()", () => {
    process.env.POSTGRES_URL = "postgresql://localhost:5432/test";
    const db1 = getDb();
    _resetDbClient();
    delete process.env.POSTGRES_URL;
    const db2 = getDb();
    expect(db1).not.toBeNull();
    expect(db2).toBeNull();
  });

  it("returns null and logs when drizzle constructor throws", async () => {
    const { drizzle } = await import("drizzle-orm/neon-http");
    vi.mocked(drizzle).mockImplementationOnce(() => {
      throw new Error("connection failed");
    });

    process.env.POSTGRES_URL = "postgresql://bad-host:5432/test";
    expect(getDb()).toBeNull();
  });
});

describe("getDbWs (WebSocket)", () => {
  it("returns null when POSTGRES_URL is unset", () => {
    expect(getDbWs()).toBeNull();
  });

  it("returns a WebSocket client when POSTGRES_URL is configured", () => {
    process.env.POSTGRES_URL = "postgresql://localhost:5432/test";
    const db = getDbWs();
    expect(db).not.toBeNull();
    expect(db).toHaveProperty("__mock", "ws");
  });

  it("returns the same instance on repeated calls (singleton)", () => {
    process.env.POSTGRES_URL = "postgresql://localhost:5432/test";
    const db1 = getDbWs();
    const db2 = getDbWs();
    expect(db1).toBe(db2);
  });

  it("re-initializes after _resetDbClient()", () => {
    process.env.POSTGRES_URL = "postgresql://localhost:5432/test";
    const db1 = getDbWs();
    _resetDbClient();
    delete process.env.POSTGRES_URL;
    const db2 = getDbWs();
    expect(db1).not.toBeNull();
    expect(db2).toBeNull();
  });

  it("does not reuse ws client across calls in edge-like runtime", () => {
    (globalThis as { EdgeRuntime?: string }).EdgeRuntime = "edge-runtime";
    process.env.POSTGRES_URL = "postgresql://localhost:5432/test";

    const db1 = getDbWs();
    const db2 = getDbWs();

    expect(db1).not.toBeNull();
    expect(db2).not.toBeNull();
    expect(db1).not.toBe(db2);
  });

  it("returns null in edge-like runtime when WebSocket constructor is unavailable", async () => {
    (globalThis as { EdgeRuntime?: string }).EdgeRuntime = "edge-runtime";
    delete (globalThis as { WebSocket?: typeof WebSocket }).WebSocket;
    process.env.POSTGRES_URL = "postgresql://localhost:5432/test";

    const db = getDbWs();
    expect(db).toBeNull();

    const { drizzle } = await import("drizzle-orm/neon-serverless");
    expect(drizzle).not.toHaveBeenCalled();
  });
});
