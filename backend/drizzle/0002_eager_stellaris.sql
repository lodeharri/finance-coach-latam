CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "embedding" vector(768);--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "embedding" vector(768);