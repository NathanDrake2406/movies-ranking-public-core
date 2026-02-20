ALTER TABLE "movies" ADD COLUMN "score_balanced" real;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "score_mainstream" real;--> statement-breakpoint
CREATE INDEX "idx_movies_top_balanced" ON "movies" USING btree ("score_balanced") WHERE "movies"."score_balanced" is not null and "movies"."coverage" >= 0.70 and "movies"."score_version" = 2;--> statement-breakpoint
CREATE INDEX "idx_movies_top_mainstream" ON "movies" USING btree ("score_mainstream") WHERE "movies"."score_mainstream" is not null and "movies"."coverage" >= 0.70 and "movies"."score_version" = 2;