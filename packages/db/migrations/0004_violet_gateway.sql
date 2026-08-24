ALTER TABLE "invite_asks" ADD COLUMN "email" text;
--> statement-breakpoint
DELETE FROM "invite_asks" WHERE "email" IS NULL;
--> statement-breakpoint
ALTER TABLE "invite_asks" ALTER COLUMN "email" SET NOT NULL;