# Runbook

Operational steps for an invite-only clipboard. Do not log secrets, tokens, recovery phrases, or plaintext.

## Revoke a device

1. Sign in as admin.
2. Open `/admin`.
3. Find the user and the device label.
4. Click **Revoke**.
5. That device’s sessions are deleted immediately. Its passkey cannot sign in again (`device_revoked`).
6. If it was the user’s last device, they recover with the 12-word phrase at `/recover`, then enroll a new passkey. No extra seat is consumed.

The audit log records `device.revoked`. Live peers get a `device.revoked` envelope with the device id only.

## Recover a vault

1. On a new browser, open `/recover`.
2. Enter handle and the 12-word phrase. The phrase never leaves the device; the server only sees a verifier hash.
3. After unwrap, enroll a passkey on this device.
4. If every device is gone, recovery rotates the identity key. Pairing fingerprints on remaining devices will change after that rotation — re-pair them.

There is no password fallback.

## Rotate the capability-token signing key

Ed25519. Web signs (`CAPABILITY_TOKEN_PRIVATE_KEY`); the Worker verifies (`CAPABILITY_TOKEN_PUBLIC_KEY`).

1. Generate a new pair locally (WebCrypto Ed25519 JWK).
2. Put the **public** JWK on the Worker: `wrangler secret put CAPABILITY_TOKEN_PUBLIC_KEY`.
3. Put the **private** JWK on Vercel as `CAPABILITY_TOKEN_PRIVATE_KEY`.
4. In-flight upload tickets (60s) minted with the old key will fail. Clients retry intent.
5. Remove the old secrets after a minute.

Do not commit JWKs. Do not put the private JWK on the Worker.

## Restore from backup

Neon is the source of truth for seats, users, devices, ciphertext metadata, and blob keys. R2 holds blob ciphertext only.

1. Restore the Neon backup to a new branch or instance.
2. Point `DATABASE_URL` at the restored database.
3. Confirm `seats` still has rows 1–10. Do not recreate seats with `COUNT(*)`.
4. R2 objects are not in the Postgres backup. After restore, run prune (Worker cron at 03:00 UTC, or `POST /api/internal/prune` with a `cron` hub ticket) so orphaned R2 prefixes are deleted and pending blobs older than one hour are dropped.
5. Sessions are hashed; users sign in again with passkeys.
6. Vault keys live on devices, not in Neon. A restored database does not recover a lost phrase.

## Prune and R2 lifecycle

Nightly Worker cron (`0 3 * * *`) tickets Vercel `/api/internal/prune`, then deletes R2 objects whose prefix is not in the keep list.

- Expired unpinned items go away. **Pinned items stay.**
- Pending blobs older than one hour go away.
- Committed blobs with no remaining item go away; `storage_used_bytes` is decremented.

Do **not** set a bucket-wide 7-day object expiry on R2. That would delete pinned blobs. Cron is the expiry path. Incomplete multipart abort is fine if you ever enable MPU.

## Rate limits

- Sends: 30/minute/user, stored on that user’s Durable Object as `bucket:send:{userId}`.
- Auth: 10/minute/IP, stored on the dedicated limiter object as `bucket:auth:{sha256(ip)}`. Over limit returns `rate_limited` (429).
- If nightly prune returns a non-2xx, the Worker logs `prune_http_{status}` and does not delete R2 objects.
