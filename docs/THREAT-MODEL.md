# Threat model

Adversary: anyone outside the 10 seats; a compromise of Vercel, Neon, or R2; a leaked link. Out of scope: a fully compromised client device, or an admin misbehaving at the metadata layer.

Design principle: the server is an untrusted courier. It can route, expire, and account for content without reading it.

## End-to-end encryption (milestone 1)

All item content, metadata envelopes, and file bytes are AES-256-GCM on the client. AAD binds `item.id`, `kind`, and `schemaVersion`, so ciphertext cannot be replayed into another slot. Blob chunks use `IV = base_iv || chunk_index`; a trailer over `chunk_count` detects truncation.

VaultKey is AES-256-GCM. After `createVault()`, the working key is **non-extractable**. WebCrypto `wrapKey` requires an extractable subject, so recovery wrapping happens before that import. `extractableVaultKey` exists only so a later pairing wrap can proceed without `exportKey` of the live key. Milestone 3 must persist a device-wrapped copy and drop the extractable handle.

Recovery is Argon2id over a 12-word BIP39 phrase (`hash-wasm`). Pairing and directed sends use ECDH P-256 → HKDF-SHA256. Both pairing devices show a 6-digit fingerprint of the shared secret so the server cannot MITM silently.

The server sees: owner, size, timestamps, kind, opaque ciphertext, wrapped keys, ephemeral public JWKs. It never sees plaintext, filenames, MIME types, or previews.

## Authentication (milestone 2)

Passkeys are origin-bound discoverable credentials. There is no password. Invite tokens are 32 random bytes shown once; only `sha256(token)` is stored. Sessions are opaque 256-bit cookies (`httpOnly; Secure; SameSite=Lax; Path=/`), hashed at rest, sliding 30 days, hard-capped at 90. Mutating routes require both SameSite and a matching `Origin`.

The 10-seat cap is a `FOR UPDATE SKIP LOCKED` claim, not a `COUNT(*)`. Zero rows means full.

The seeded admin has no passkey. First enroll is invite-less and gated by `ADMIN_ENROLL_SECRET`. Anyone who knows that secret can bind the first admin device; after a device exists the route is closed.

## Vault and pairing (milestone 3)

`createVault()` wraps recovery while the key is extractable, then imports a non-extractable working copy. Each browser stores a device-local wrapping key in IndexedDB and a device-wrapped extractable clone so a later pairing wrap can proceed without keeping extractable material in RAM.

Pairing: the new device creates a 5-minute session with its ephemeral ECDH public JWK (no login yet — `pairing_sessions.user_id` is null until wrap). The enrolled device wraps VaultKey plus a vault-wrapped identity private key, shows a 6-digit fingerprint of the ECDH shared secret, and posts the blob only after the user confirms. The new device computes the same fingerprint locally and does not unwrap until the numbers match. The server cannot MITM silently. After unwrap, the new device enrolls a passkey onto the existing user (no extra seat).

Recovery: Argon2id over the 12-word phrase unwraps `wrapped_vault_recovery`. A phrase-derived verifier hash (`recovery_verifier_hash`) lets a lost-all-devices client prove possession without giving the server VaultKey. Total-loss recovery rotates the identity key because identity private has no server column.

Items in this milestone are ciphertext-only create/list so a second device can fetch and decrypt. Live fan-out is milestone 4.

## Realtime (milestone 4)

Text and link items persist as ciphertext with a 30-day TTL and a 64 KB cap. After a write, Vercel posts an HMAC-ticketed envelope to the Worker. One Durable Object per user vault fans `item.created` / `item.deleted` to hibernated WebSockets. Tickets are 60-second HMAC tokens minted by the app (`HUB_SECRET`); the Worker verifies them and never sees plaintext. A missing or expired ticket is denied. P2P DataChannel remains milestone 7.

## PWA (milestone 5)

The service worker (Serwist) intercepts Android Share Target POSTs, writes the shared text to a local IndexedDB inbox, and redirects home. The signed-in client encrypts and POSTs ciphertext like any other item. The origin never sees the share body. Web Push payloads are only `New item from {displayName}`; the client fetches and decrypts on open. `VAPID_PRIVATE_KEY` is required to send; it is not in the original env list. iOS has no Share Target; do not add a plaintext clipboard ingest route.

## Uploads (milestone 6)

Vercel never writes to R2. It checks `can_upload` and remaining quota, inserts a pending blob with a server-generated key, and mints a 60s EdDSA JWT (`CAPABILITY_TOKEN_PRIVATE_KEY`). The Worker verifies that JWT (`CAPABILITY_TOKEN_PUBLIC_KEY`), rejects missing/oversize `Content-Length`, and only then PUTs ciphertext. Spec said Vercel `HeadObject`s R2; Vercel has no R2 credentials, so commit calls Worker `GET /stat` with a capability token. Admin approval grants quota bytes, not a boolean. Filenames and MIME types stay in the encrypted metadata envelope.

## P2P (milestone 7)

WebRTC DataChannels carry ciphertext only; Zod rejects a `plaintext` field on the DC envelope. Signalling (`rtc.offer` / `rtc.answer` / `rtc.ice`) is unicast through the Durable Object and must present the sender's `deviceId` from the socket attachment. ICE is STUN-only — no TURN, so some networks fall back to the server path without an error. **Local** means the nominated ICE pair is host/host. Ephemeral items skip Postgres and R2; if no peer is connected they fail closed.
