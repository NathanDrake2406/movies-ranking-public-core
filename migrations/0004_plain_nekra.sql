CREATE TABLE "award_probabilities" (
	"source" text DEFAULT 'kalshi' NOT NULL,
	"award_slug" text NOT NULL,
	"season_year" smallint NOT NULL,
	"category_slug" text NOT NULL,
	"category_label" text NOT NULL,
	"nominee_slug" text NOT NULL,
	"nominee_label" text NOT NULL,
	"imdb_id" text,
	"probability_raw" real NOT NULL,
	"probability_norm" real NOT NULL,
	"market_id" text NOT NULL,
	"market_url" text,
	"closes_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "award_probabilities_source_award_slug_season_year_category_slug_nominee_slug_pk" PRIMARY KEY("source","award_slug","season_year","category_slug","nominee_slug"),
	CONSTRAINT "chk_award_probabilities_probability_raw_range" CHECK ("award_probabilities"."probability_raw" >= 0 and "award_probabilities"."probability_raw" <= 1),
	CONSTRAINT "chk_award_probabilities_probability_norm_range" CHECK ("award_probabilities"."probability_norm" >= 0 and "award_probabilities"."probability_norm" <= 1)
);
--> statement-breakpoint
ALTER TABLE "award_probabilities" ADD CONSTRAINT "award_probabilities_imdb_id_movies_imdb_id_fk" FOREIGN KEY ("imdb_id") REFERENCES "public"."movies"("imdb_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_award_probabilities_source_market_nominee" ON "award_probabilities" USING btree ("source","market_id","nominee_slug");--> statement-breakpoint
CREATE INDEX "idx_award_probabilities_award_season_category_prob" ON "award_probabilities" USING btree ("award_slug","season_year","category_slug","probability_norm");--> statement-breakpoint
CREATE INDEX "idx_award_probabilities_award_season_active" ON "award_probabilities" USING btree ("award_slug","season_year","is_active");
