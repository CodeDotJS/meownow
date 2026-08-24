ALTER TABLE "upload_requests" ADD COLUMN "requested_bytes" bigint;
--> statement-breakpoint
UPDATE "upload_requests" SET "requested_bytes" = 26214400 WHERE "requested_bytes" IS NULL;
--> statement-breakpoint
ALTER TABLE "upload_requests" ALTER COLUMN "requested_bytes" SET NOT NULL;