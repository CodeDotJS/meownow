DELETE FROM "pairing_sessions" WHERE "expires_at" <= now();--> statement-breakpoint
ALTER TABLE "pairing_sessions" ADD COLUMN "code" text;--> statement-breakpoint
UPDATE "pairing_sessions" SET "code" = upper(substr(replace("id"::text, '-', ''), 1, 8)) WHERE "code" IS NULL;--> statement-breakpoint
ALTER TABLE "pairing_sessions" ALTER COLUMN "code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pairing_sessions" ADD CONSTRAINT "pairing_sessions_code_unique" UNIQUE("code");
