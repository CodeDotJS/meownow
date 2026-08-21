ALTER TABLE "pairing_sessions" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pairing_sessions" ALTER COLUMN "fingerprint" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "recovery_verifier_hash" "bytea";