DROP INDEX "idx_scores_imdb_id";--> statement-breakpoint
DROP INDEX "idx_movies_top";--> statement-breakpoint
DROP INDEX "idx_movies_divisive";--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "director_photos" text[];--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "themes" jsonb;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "consensus" jsonb;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "imdb_summary" text;--> statement-breakpoint
CREATE INDEX "idx_movies_top" ON "movies" USING btree ("overall_score") WHERE "movies"."overall_score" is not null and "movies"."coverage" >= 0.70 and "movies"."score_version" = 2;--> statement-breakpoint
CREATE INDEX "idx_movies_divisive" ON "movies" USING btree ("disagreement") WHERE "movies"."overall_score" is not null and "movies"."coverage" >= 0.70 and "movies"."score_version" = 2;