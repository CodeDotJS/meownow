# Threat model

Adversary: anyone without a valid invite or session; a compromise of Vercel, Neon, or R2; a leaked link. Out of scope: a fully compromised client device, or an admin misbehaving at the metadata layer.

Design principle: the server is an untrusted courier. It can route, expire, and account for content without reading it.

## End-to-end encryption (milestone 1)

All item content, metadata envelopes, and file bytes are AES-256-GCM on the client. AAD binds `item.id`, `kind`, and `schemaVersion`, so ciphertext cannot be replayed into another slot. Blob chunks use `IV = base_iv || chunk_index`; a trailer over `chunk_count` detects truncation.

VaultKey is AES-256-GCM. After `createVault()`, the working key is **non-extractable**. WebCrypto `wrapKey` requires an extractable subject, so recovery wrapping happens before that import. `extractableVaultKey` exists only so a later pairing wrap can proceed without `exportKey` of the live key. Milestone 3 must persist a device-wrapped copy and drop the extractable handle.

Recovery is Argon2id over a 12-word BIP39 phrase (`hash-wasm`). Pairing and directed sends use ECDH P-256 → HKDF-SHA256. Both pairing devices show a 6-digit fingerprint of the shared secret so the server cannot MITM silently.

The server sees: owner, size, timestamps, kind, opaque ciphertext, wrapped keys, ephemeral public JWKs. It never sees plaintext, filenames, MIME types, or previews.

## Authentication (milestone 2)

Passkeys are origin-bound discoverable credentials. There is no password. Invite tokens are 32 random bytes shown once; only `sha256(token)` is stored. Sessions are opaque 256-bit cookies (`httpOnly; Secure; SameSite=Lax; Path=/`), hashed at rest, sliding 30 days, hard-capped at 90. Mutating routes require both SameSite and a matching `Origin`.

Membership is invite-only. There is no numeric seat cap. An unused, unexpired, unrevoked invite is the only way to create a member. `/play` is not a member and does not write Neon, R2, or the hub. Guests may leave an email and an optional note at `/ask`; that write is rate-limited, stores no IP, and never creates a seat. An admin still has to mint and send a `/join?t=` link.

The seeded admin has no passkey. First enroll is invite-less and gated by `ADMIN_ENROLL_SECRET`. Anyone who knows that secret can bind the first admin device; after a device exists the route is closed.

## Vault and pairing (milestone 3)

`createVault()` wraps recovery while the key is extractable, then imports a non-extractable working copy. Each browser stores a device-local wrapping key in IndexedDB and a device-wrapped extractable clone so a later pairing wrap can proceed without keeping extractable material in RAM.

Pairing: the new device creates a 5-minute session with its ephemeral ECDH public JWK (no login yet — `pairing_sessions.user_id` is null until wrap) and an 8-character Crockford code. The enrolled device finds that session by scanning the QR or by a signed-in, rate-limited code lookup, wraps VaultKey plus a vault-wrapped identity private key, and POSTs that blob so the waiting browser can show the same 6-digit fingerprint. Both sides confirm the numbers before the new device unwraps. A wrap that does not match the local fingerprint is aborted. The server cannot MITM silently. After unwrap, the new device enrolls a passkey onto the existing user (no extra seat). The code is only a lookup key, not a login.

Recovery: Argon2id over the 12-word phrase unwraps `wrapped_vault_recovery`. A phrase-derived verifier hash (`recovery_verifier_hash`) lets a lost-all-devices client prove possession without giving the server VaultKey. Total-loss recovery rotates the identity key because identity private has no server column.

Items in this milestone are ciphertext-only create/list so a second device can fetch and decrypt. Live fan-out is milestone 4.

## Realtime (milestone 4)

Text and link items persist as ciphertext with a 30-day TTL and a 64 KB cap. After a write, Vercel posts an HMAC-ticketed envelope to the Worker. One Durable Object per user vault fans `item.created` / `item.updated` / `item.deleted` to hibernated WebSockets. An edit is `PATCH /api/items/:id` with a new IV and ciphertext on the same row; the server does not see plaintext and does not reset `expires_at`. Tickets are 60-second HMAC tokens minted by the app (`HUB_SECRET`); the Worker verifies them and never sees plaintext. A missing or expired ticket is denied. P2P DataChannel remains milestone 7.

## PWA (milestone 5)

The signed-in page registers `/sw.js` (classic worker). The service worker (Serwist) intercepts Android Share Target POSTs, writes the shared text to a local IndexedDB inbox, and redirects home. The signed-in client encrypts and POSTs ciphertext like any other item. The origin never sees the share body. Web Push payloads are only `New item from {displayName}`; the client fetches and decrypts on open. `VAPID_PRIVATE_KEY` is required to send; it is not in the original env list. iOS has no Share Target; do not add a plaintext clipboard ingest route. A newer build is detected with `registration.update()`, `updatefound`, and `controllerchange` — not a version document from the server. Reload is a tap on the cat chip, not an automatic navigation.

`/api/` and Worker upload/download paths are network-only in the service worker. The clipboard cache (`meownow-items`) stores ciphertext envelopes plus this-browser Sync and tray preferences and a `lastMe` snapshot so chrome can render when `/api/auth/me` is unreachable. Plaintext is still not on the server. `lastMe` is not a session and does not authorize writes. Device compromise remains out of scope.

## Playground (milestone 10)

`/play` is a look-and-feel tray for a browser with no session and no local vault. Notes live in a separate IndexedDB (`meownow-play`), not `meownow-items`. They are ordinary local records, not a vault. They never go to Neon, R2, or the hub. A guest `POST /api/items` (or upload, or hub ticket) is still denied. Cap is five current notes in the write helper; Forget frees a slot. That cap is UX in this page, not authorization. A person who edits this browser's IndexedDB can keep more rows here and still cannot write the store or become a member. Do not move the cap to Neon to "enforce" it. When a vault exists on this browser, drop `meownow-play` — do not POST those notes. No Share Target into the playground. Clearing site data wipes it. XSS on the origin can read that DB; that stays the same device-compromise class, out of scope. Do not log note text.

## Uploads (milestone 6)

Vercel never writes to R2. It checks `can_upload` and remaining quota, inserts a pending blob with a server-generated key, and mints a 60s EdDSA JWT (`CAPABILITY_TOKEN_PRIVATE_KEY`). The Worker verifies that JWT (`CAPABILITY_TOKEN_PUBLIC_KEY`), rejects missing/oversize `Content-Length`, and only then PUTs ciphertext. Browser PUTs to `/upload` (and GETs `/dl`) are cross-origin; the Worker answers CORS only for `APP_URL` / `APP_ORIGINS`. An unknown origin gets no ACAO. Spec said Vercel `HeadObject`s R2; Vercel has no R2 credentials, so commit calls Worker `GET /stat` with a capability token. Admin approval grants 25–100 MB of quota, not a boolean. Filenames and MIME types stay in the encrypted metadata envelope. Images are redrawn to a canvas before encryption so EXIF/GPS does not survive. Client gzip (fflate) runs on plaintext before AEAD; the codec flag stays in that same envelope. Already-packed bytes are left alone when gzip does not shrink them. The Worker still only stores ciphertext.

## P2P (milestone 7)

WebRTC DataChannels carry ciphertext only; Zod rejects a `plaintext` field on the DC envelope. Signalling (`rtc.offer` / `rtc.answer` / `rtc.ice`) is unicast through the Durable Object and must present the sender's `deviceId` from the socket attachment. ICE is STUN-only — no TURN. Client-isolated Wi‑Fi (JioFiber and similar) and missing NAT hairpin mean host/host often never forms; that is not a threat, it is the network. **Local** still means the nominated ICE pair is host/host. Trickle ICE is queued until `setRemoteDescription` so early candidates are not dropped.

Ephemeral items skip Postgres and R2. Fail closed means do not persist, not "DataChannel or discard." If no channel is open, the sender fans the same ciphertext over the hub as `item.created` with `ephemeral: true`. The Durable Object sees the same sealed fields it already sees for a stored note and does not keep the row. The Worker must parse that flag; stripping it makes the receiver drop the note on the next GET. If the hub is down too, the note stays on the sending device.

## Admin (milestone 8)

Directory, audit, and usage are admin-only. A member session is `403 forbidden` even with a hand-crafted `/api/admin/*` request. The dashboard shows metadata: handles, quota, device labels, audit actions. It does not show plaintext, filenames, or MIME types. Device revoke sets `revoked_at` and deletes sessions; `device.revoked` is fanned out as an id only. User remove deletes the Neon rows (`ON DELETE CASCADE` / `SET NULL`), after clearing invite/audit FKs that are not nullable. A signed-in user can delete their own account with `POST /api/auth/account/delete` and their handle; the last admin is `409 last_admin`. A member still cannot hit `/api/admin/users/:id/remove`. Pixel avatars are drawn in the browser and never stored. R2 objects for a removed user are not deleted here — that is the milestone 9 sweep. Class B ops are not counted without Worker telemetry.

## Hardening (milestone 9)

HTML responses carry a per-request CSP nonce with `strict-dynamic`, `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`, and `require-trusted-types-for 'script'`. `style-src` allows `'unsafe-inline'` because React inline styles (TTL hairline, usage meter) cannot be nonced. Trusted Types policies include Next’s `nextjs` / `nextjs#bundler` names. Registering `/sw.js` uses a `meownow#sw` policy that only mints that script URL. `@serwist/next` auto-register is off so it cannot call `register()` with a raw string. Wire schemas are Zod 4 with `jitless`, so they never probe `new Function`.

Decrypted notes may contain markdown. The page lexes them and builds React nodes. It does not assign `innerHTML` from item plaintext. Link hrefs must be `http:`, `https:`, or `mailto:`; `javascript:` and relative URLs are dropped. Markdown images are not fetched. Raw HTML in a note is shown as text. The envelope still stores markdown source, not rendered HTML.

Send and auth rate limits are token buckets in Durable Object storage (`bucket:send:{userId}` on that user’s object, `bucket:auth:{sha256(ip)}` on the dedicated limiter object). Vercel never trusts the UI for this: a 429 is `rate_limited`. Auth limiter keys are `sha256(ip)`, not the raw address. If `EDGE_URL` or `HUB_SECRET` is unset in production, `take()` denies. In development it allows so local pages work without a Worker.

Nightly Worker cron tickets `POST /api/internal/prune` (`purpose: cron`). Vercel deletes expired unpinned rows, expired sessions/pairings, and pending blobs older than one hour, then returns keep/delete R2 prefixes. The Worker deletes R2 objects whose prefix is not kept. **Pinned items are not expired.** A bucket-wide R2 lifecycle expiry would delete pinned blobs, so it is not configured.

`docs/RUNBOOK.md` covers device revoke, vault recovery, capability-key rotation, and backup restore.
