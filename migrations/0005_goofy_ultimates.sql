CREATE TABLE "ceremony_results" (
	"ceremony_slug" text NOT NULL,
	"season_year" smallint NOT NULL,
	"category_slug" text NOT NULL,
	"category_label" text NOT NULL,
	"nominee_slug" text NOT NULL,
	"nominee_label" text NOT NULL,
	"person_label" text,
	"film_title" text NOT NULL,
	"film_year" smallint,
	"imdb_id" text,
	"is_winner" boolean DEFAULT false NOT NULL,
	"wikidata_qid" text,
	"last_ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ceremony_results_ceremony_slug_season_year_category_slug_nominee_slug_pk" PRIMARY KEY("ceremony_slug","season_year","category_slug","nominee_slug")
);
--> statement-breakpoint
ALTER TABLE "ceremony_results" ADD CONSTRAINT "ceremony_results_imdb_id_movies_imdb_id_fk" FOREIGN KEY ("imdb_id") REFERENCES "public"."movies"("imdb_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ceremony_results_season_category_winner" ON "ceremony_results" USING btree ("season_year","category_slug","is_winner");--> statement-breakpoint
CREATE INDEX "idx_ceremony_results_ceremony_season" ON "ceremony_results" USING btree ("ceremony_slug","season_year");--> statement-breakpoint
CREATE INDEX "idx_ceremony_results_imdb_id" ON "ceremony_results" USING btree ("imdb_id");