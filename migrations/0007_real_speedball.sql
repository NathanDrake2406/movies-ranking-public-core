CREATE INDEX "idx_movies_moods_gin" ON "movies" USING gin ("moods");--> statement-breakpoint
CREATE INDEX "idx_movies_directors_coalesce_gin" ON "movies" USING gin (COALESCE("directors", ARRAY["director"]));
