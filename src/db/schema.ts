import {
  pgTable,
  text,
  integer,
  smallint,
  real,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { CURRENT_SCORE_VERSION } from "./score-version";

const CURRENT_SCORE_VERSION_SQL = sql.raw(String(CURRENT_SCORE_VERSION));

// ─── Movies table ─────────────────────────────────────────────────────────────

export const movies = pgTable(
  "movies",
  {
    imdbId: text("imdb_id").primaryKey(),
    tmdbId: integer("tmdb_id"),
    title: text("title").notNull(),
    year: smallint("year"),
    poster: text("poster"),
    overview: text("overview"),
    runtime: smallint("runtime"),
    rating: text("rating"),
    genres: text("genres").array(),
    director: text("director"),
    directors: text("directors").array(),
    directorPhotos: text("director_photos").array(),
    writers: text("writers").array(),
    cinematographer: text("cinematographer"),
    editor: text("editor"),
    composer: text("composer"),
    castMembers: text("cast_members").array(),
    watchProviderIds: integer("watch_provider_ids").array(),
    moods: text("moods").array(),
    themes: jsonb("themes"),
    consensus: jsonb("consensus"),
    imdbSummary: text("imdb_summary"),
    overallScore: real("overall_score"),
    scoreBalanced: real("score_balanced"),
    scoreMainstream: real("score_mainstream"),
    coverage: real("coverage"),
    disagreement: real("disagreement"),
    sourcesCount: smallint("sources_count").notNull().default(0),
    isComplete: boolean("is_complete").notNull().default(false),
    scoreVersion: smallint("score_version").notNull().default(1),
    lastFetchedAt: timestamp("last_fetched_at", {
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => {
    const rankQualityGate = sql`${table.coverage} >= 0.70 and ${table.scoreVersion} = ${CURRENT_SCORE_VERSION_SQL}`;

    return [
      // Full indexes
      index("idx_movies_year").on(table.year),
      index("idx_movies_genres_gin").using("gin", table.genres),
      index("idx_movies_moods_gin").using("gin", table.moods),
      index("idx_movies_watch_providers_gin").using(
        "gin",
        table.watchProviderIds,
      ),
      index("idx_movies_directors_coalesce_gin").using(
        "gin",
        sql`COALESCE(${table.directors}, ARRAY[${table.director}])`,
      ),
      index("idx_movies_last_fetched").on(table.lastFetchedAt),
      index("idx_movies_score_version").on(table.scoreVersion),
      uniqueIndex("idx_movies_tmdb_id")
        .on(table.tmdbId)
        .where(sql`${table.tmdbId} is not null`),

      // Partial indexes for ranked list queries (quality gate in predicate).
      index("idx_movies_top")
        .on(table.overallScore)
        .where(sql`${table.overallScore} is not null and ${rankQualityGate}`),
      index("idx_movies_divisive")
        .on(table.disagreement)
        .where(sql`${table.overallScore} is not null and ${rankQualityGate}`),
      index("idx_movies_top_balanced")
        .on(table.scoreBalanced)
        .where(sql`${table.scoreBalanced} is not null and ${rankQualityGate}`),
      index("idx_movies_top_mainstream")
        .on(table.scoreMainstream)
        .where(
          sql`${table.scoreMainstream} is not null and ${rankQualityGate}`,
        ),
      index("idx_movies_year_overall_top")
        .on(table.year, table.overallScore.desc())
        .where(
          sql`${table.year} is not null and ${table.overallScore} is not null and ${rankQualityGate}`,
        ),
    ];
  },
);

// ─── Scores table ─────────────────────────────────────────────────────────────

export const scores = pgTable(
  "scores",
  {
    imdbId: text("imdb_id")
      .notNull()
      .references(() => movies.imdbId, { onDelete: "cascade" }),
    source: text("source").notNull(),
    label: text("label").notNull(),
    normalized: real("normalized"),
    rawValue: real("raw_value"),
    rawScale: text("raw_scale"),
    count: integer("count"),
    url: text("url"),
    error: text("error"),
    fromFallback: boolean("from_fallback").default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.imdbId, table.source] }),
    check(
      "source_check",
      sql`${table.source} in ('allocine_press','allocine_user','douban','imdb','letterboxd','metacritic','rotten_tomatoes','rotten_tomatoes_all','rotten_tomatoes_audience','rotten_tomatoes_top')`,
    ),
  ],
);

// ─── Award probabilities table ───────────────────────────────────────────────

export const awardProbabilities = pgTable(
  "award_probabilities",
  {
    source: text("source").notNull().default("kalshi"),
    awardSlug: text("award_slug").notNull(),
    seasonYear: smallint("season_year").notNull(),
    categorySlug: text("category_slug").notNull(),
    categoryLabel: text("category_label").notNull(),
    nomineeSlug: text("nominee_slug").notNull(),
    nomineeLabel: text("nominee_label").notNull(),
    imdbId: text("imdb_id").references(() => movies.imdbId, {
      onDelete: "set null",
    }),
    probabilityRaw: real("probability_raw").notNull(),
    probabilityNorm: real("probability_norm").notNull(),
    marketId: text("market_id").notNull(),
    marketUrl: text("market_url"),
    closesAt: timestamp("closes_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    lastIngestedAt: timestamp("last_ingested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.source,
        table.awardSlug,
        table.seasonYear,
        table.categorySlug,
        table.nomineeSlug,
      ],
    }),
    uniqueIndex("ux_award_probabilities_source_market_nominee").on(
      table.source,
      table.marketId,
      table.nomineeSlug,
    ),
    index("idx_award_probabilities_award_season_category_prob").on(
      table.awardSlug,
      table.seasonYear,
      table.categorySlug,
      table.probabilityNorm,
    ),
    index("idx_award_probabilities_award_season_active").on(
      table.awardSlug,
      table.seasonYear,
      table.isActive,
    ),
    check(
      "chk_award_probabilities_probability_raw_range",
      sql`${table.probabilityRaw} >= 0 and ${table.probabilityRaw} <= 1`,
    ),
    check(
      "chk_award_probabilities_probability_norm_range",
      sql`${table.probabilityNorm} >= 0 and ${table.probabilityNorm} <= 1`,
    ),
  ],
);

// ─── Ceremony results table ─────────────────────────────────────────────────

export const ceremonyResults = pgTable(
  "ceremony_results",
  {
    ceremonySlug: text("ceremony_slug").notNull(),
    seasonYear: smallint("season_year").notNull(),
    categorySlug: text("category_slug").notNull(),
    categoryLabel: text("category_label").notNull(),
    nomineeSlug: text("nominee_slug").notNull(),
    nomineeLabel: text("nominee_label").notNull(),
    personLabel: text("person_label"),
    filmTitle: text("film_title").notNull(),
    filmYear: smallint("film_year"),
    imdbId: text("imdb_id"), // soft reference — no FK so ingestion always stores the ID
    isWinner: boolean("is_winner").notNull().default(false),
    personPhoto: text("person_photo"),
    wikidataQid: text("wikidata_qid"),
    lastIngestedAt: timestamp("last_ingested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.ceremonySlug,
        table.seasonYear,
        table.categorySlug,
        table.nomineeSlug,
      ],
    }),
    index("idx_ceremony_results_season_category_winner").on(
      table.seasonYear,
      table.categorySlug,
      table.isWinner,
    ),
    index("idx_ceremony_results_ceremony_season").on(
      table.ceremonySlug,
      table.seasonYear,
    ),
    index("idx_ceremony_results_imdb_id").on(table.imdbId),
  ],
);

// ─── Type exports ─────────────────────────────────────────────────────────────

export type Movie = typeof movies.$inferSelect;
export type NewMovie = typeof movies.$inferInsert;
export type Score = typeof scores.$inferSelect;
export type NewScore = typeof scores.$inferInsert;
export type AwardProbability = typeof awardProbabilities.$inferSelect;
export type NewAwardProbability = typeof awardProbabilities.$inferInsert;
export type CeremonyResult = typeof ceremonyResults.$inferSelect;
export type NewCeremonyResult = typeof ceremonyResults.$inferInsert;
