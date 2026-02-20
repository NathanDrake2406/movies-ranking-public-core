ALTER TABLE "movies" ADD COLUMN "editor" text;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "watch_provider_ids" integer[];--> statement-breakpoint
CREATE INDEX "idx_movies_watch_providers_gin" ON "movies" USING gin ("watch_provider_ids");