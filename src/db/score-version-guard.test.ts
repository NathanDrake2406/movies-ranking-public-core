import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CURRENT_SCORE_VERSION as PERSIST_SCORE_VERSION } from "./persist";
import { CURRENT_SCORE_VERSION } from "./score-version";

const SCHEMA_PATH = join(import.meta.dirname, "schema.ts");
const MIGRATIONS_DIR = join(import.meta.dirname, "../../migrations");

const VERSION_SCOPED_PARTIAL_INDEXES = [
  "idx_movies_top",
  "idx_movies_divisive",
  "idx_movies_top_balanced",
  "idx_movies_top_mainstream",
  "idx_movies_year_overall_top",
] as const;

function migrationFilesInOrder(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => /^\d+_.*\.sql$/.test(file))
    .sort((a, b) => Number(a.split("_")[0]) - Number(b.split("_")[0]));
}

function latestCreateIndexStatement(
  indexName: string,
): { readonly file: string; readonly statement: string } | null {
  let latest: { readonly file: string; readonly statement: string } | null =
    null;

  for (const file of migrationFilesInOrder()) {
    const source = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
    const pattern = new RegExp(`CREATE INDEX "${indexName}"[\\s\\S]*?;`, "g");
    const matches = [...source.matchAll(pattern)];
    if (matches.length > 0) {
      const statement = matches[matches.length - 1]![0]!;
      latest = { file, statement };
    }
  }

  return latest;
}

describe("score-version index guard", () => {
  it("persist re-exports the canonical score version", () => {
    expect(PERSIST_SCORE_VERSION).toBe(CURRENT_SCORE_VERSION);
  });

  it("schema partial index predicates are version-scoped without hardcoded literals", () => {
    const source = readFileSync(SCHEMA_PATH, "utf-8");

    const hardcodedVersionPattern = /\$\{table\.scoreVersion\}\s*=\s*\d+/g;
    const hardcodedMatches = [...source.matchAll(hardcodedVersionPattern)];

    expect(
      hardcodedMatches.length,
      "Do not hardcode `scoreVersion = <number>` in schema partial index predicates. " +
        "Use the shared CURRENT_SCORE_VERSION constant so bumps flow through schema generation safely.",
    ).toBe(0);

    expect(source).toContain("CURRENT_SCORE_VERSION_SQL");

    for (const indexName of VERSION_SCOPED_PARTIAL_INDEXES) {
      expect(
        source.includes(`index("${indexName}")`),
        `Missing schema definition for ${indexName}.`,
      ).toBe(true);
    }
  });

  it("latest migration CREATE INDEX for each version-scoped partial index matches CURRENT_SCORE_VERSION", () => {
    for (const indexName of VERSION_SCOPED_PARTIAL_INDEXES) {
      const latest = latestCreateIndexStatement(indexName);

      expect(
        latest,
        `Missing CREATE INDEX migration statement for ${indexName}. ` +
          "Generate a migration when adding or changing version-scoped partial indexes.",
      ).not.toBeNull();

      const statement = latest!.statement;
      const versionMatch = statement.match(/"score_version"\s*=\s*(\d+)/);

      expect(
        versionMatch,
        `Index ${indexName} in ${latest!.file} is not score_version scoped. ` +
          "Version-scoped ranking indexes must include score_version in the partial predicate.",
      ).not.toBeNull();

      const predicateVersion = Number(versionMatch![1]);
      expect(
        predicateVersion,
        `Index ${indexName} in ${latest!.file} has score_version = ${predicateVersion}, ` +
          `but CURRENT_SCORE_VERSION is ${CURRENT_SCORE_VERSION}. ` +
          "Create a migration that drops/recreates version-scoped partial indexes for the new score version.",
      ).toBe(CURRENT_SCORE_VERSION);
    }
  });
});
