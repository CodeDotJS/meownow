# meownow — architecture decisions and build prompt

Two parts. Part 1 is the thinking: constraints, decisions, and the reasoning behind them, including three places where your brief runs into hard platform limits. Part 2 is the prompt you hand to Claude Code to start the repo.

---

# Part 1 — Architecture

## 1.1 Three things in the brief that don't work as stated

Getting these settled first, because each one changes the design.

### Bluetooth is not available to you

Web Bluetooth only implements the GATT **central** role. A browser can connect *to* a Bluetooth peripheral (a heart-rate monitor, a thermostat). No browser implements the **peripheral** role, so two browsers cannot see each other over Bluetooth. On top of that, Firefox and Safari don't ship Web Bluetooth at all, and iOS has no support in any browser. There is no path from "PWA" to "Bluetooth file transfer between my laptop and my phone."

**What you actually want from Bluetooth** is: fast, works without the internet round-trip, bytes stay local. WebRTC gives you all three. When both devices are on the same Wi-Fi, ICE resolves to **host candidates** and the DataChannel connects directly over the LAN. The signalling handshake goes through a server, but the payload never leaves your network. It is also roughly 50-100x faster than BLE throughput.

So: **LAN-direct via WebRTC is the "bluetooth mode."** Label it "Local" in the UI and say why it's fast.

### Background clipboard monitoring is impossible in a browser

There is no clipboard-change event in any web platform spec. `navigator.clipboard.readText()` requires transient user activation, and outside Chromium it requires an actual paste gesture. A web app cannot poll your clipboard while backgrounded. Any design that assumes "I copy on desktop and it silently appears on my phone" will fail.

The realistic ceiling for pure web is **one gesture on each end**. Minimise that gesture:

| Platform | Capture (send) | Receive |
|---|---|---|
| Desktop Chrome/Edge | `paste` event anywhere in the app (gets images via `clipboardData.files`), drag-and-drop, PWA shortcut | One-click Copy per item |
| Android (installed PWA) | **Web Share Target** — meownow appears in the Android share sheet. This is the single best UX win in the whole project. | Tap Copy, or open from push notification |
| iOS (installed PWA, 16.4+) | No Share Target support. Paste button (Safari shows a native paste callout), or an **iOS Shortcut** that POSTs the clipboard to your API — put this in the docs, it's the closest thing to native on iOS | Tap Copy |

If you later want true background capture, that is a **v2 companion**: a browser extension (`clipboardRead` permission) or a small tray app. Design the API so a companion can be bolted on without touching the core. Do not build it in v1.

### Vercel Postgres no longer exists

<cite index="21-1">Vercel shut down its native Postgres product in June 2025 and every existing database was automatically migrated to Neon</cite>. Today you install **Neon** through the Vercel Marketplace; credentials get auto-injected as env vars and billing stays under Vercel. Functionally what you asked for, different name. Use `@neondatabase/serverless` (HTTP for single queries, WebSocket for transactions), not the dead `@vercel/postgres`.

Two more Vercel constraints that shape the design:

- **4.5 MB request body cap** on Vercel Functions. Blobs must go **direct to R2**, never through Vercel.
- **No long-lived WebSockets.** Serverless functions can't hold a socket open for realtime fan-out.

That second one is why the architecture below puts realtime on Cloudflare.

---

## 1.2 Shape of the system

```
                   ┌──────────────────────────────────────┐
                   │  Client (PWA, React)                 │
                   │  · WebCrypto: all encrypt/decrypt     │
                   │  · IndexedDB: vault key + local cache │
                   │  · Service worker: share target, push │
                   └───┬──────────┬──────────────┬─────────┘
                       │          │              │
         auth / metadata│    WebSocket           │ WebRTC DataChannel
         (HTTPS)        │    (realtime +         │ (LAN-direct, payload
                       │     RTC signalling)     │  never hits a server)
                       ▼          ▼              ▼
        ┌───────────────────┐  ┌────────────────────┐   ┌────────┐
        │ Vercel            │  │ Cloudflare Worker  │◄──┤ peer   │
        │ Next.js 15        │  │ · /ws → HubDO      │   └────────┘
        │ · WebAuthn        │  │ · /upload → R2     │
        │ · invites, seats  │  │ · /dl → R2         │
        │ · upload approval │  │ · cron: prune      │
        │ · issues capability│ │ · rate limiting    │
        │   tokens (JWT)    │  └─────────┬──────────┘
        └─────────┬─────────┘            │
                  │                      ▼
                  ▼                  ┌────────┐
          ┌──────────────┐           │  R2    │  ciphertext only
          │ Neon Postgres│           └────────┘
          │ ciphertext + │
          │ metadata only│
          └──────────────┘
```

**Division of labour**

- **Vercel** owns identity, authorisation, and the source of truth for metadata. It is the only thing that decides *who may do what*. It never touches file bytes.
- **Cloudflare Worker** owns everything that needs to be stateful, streaming, or long-lived: the WebSocket hub, the upload gate, downloads, and cron. It never decides policy; it only verifies capability tokens minted by Vercel.
- **R2** stores ciphertext blobs. Bucket is private, no public access, no custom domain.
- **Neon** stores metadata and small ciphertext payloads.

**Why the Worker instead of doing it all on Vercel:** Durable Objects with the SQLite backend are <cite index="15-1">available on the Workers Free plan</cite>, WebSocket Hibernation makes idle connections free, and <cite index="16-1">max WebSocket message size is 32 MiB</cite>. Free tier is <cite index="11-1">100,000 requests/day, resetting at 00:00 UTC</cite>. For 10 users that is not a constraint you will ever feel.

You are already on Cloudflare for R2, so this adds zero vendors.

---

## 1.3 Security model

**Threat model, stated plainly.** The adversary is: (a) anyone who is not one of your 10 people, (b) a compromise of Vercel/Neon/R2 or of your own admin account, (c) a link leaked out of the app. Not in scope: a fully compromised client device, or you as admin misbehaving at the metadata layer.

**Design principle:** the server is a dumb, untrusted courier. It must be able to route, expire, and bill your content without being able to read it.

### End-to-end encryption

This is not optional if you want "solid and secure" while parking data on third-party infrastructure. It also conveniently makes the leaked-link problem disappear.

**Key hierarchy**

```
VaultKey (AES-256-GCM, per user, never leaves the client)
├── encrypts small text/link items directly
├── wraps FileKey (one per blob)
├── wraps IdentityKey (ECDH P-256, for receiving from other users)
└── is itself wrapped by:
    ├── device-link key (ECDH, during QR pairing) → transient
    └── recovery key (Argon2id over a 12-word phrase) → stored server-side, ciphertext
```

`VaultKey` lives in IndexedDB as a **non-extractable** `CryptoKey`. Structured clone preserves it across sessions; non-extractable means even XSS can use it but cannot exfiltrate it. Meaningful hardening for near-zero cost.

**Adding a device (the flow that has to feel effortless)**

1. New device generates an ephemeral ECDH P-256 keypair, shows a QR containing its public JWK plus a pairing session id, and an 8-character typed code for the same session.
2. Enrolled device scans the QR or types the code (signed-in lookup). It does ECDH → HKDF-SHA256 → wrapping key, AES-GCM-wraps `VaultKey`, POSTs the wrapped blob to the pairing session.
3. **Both devices display a 6-digit fingerprint of the shared secret.** User confirms they match. This is what stops your own server from MITMing the pairing.
4. New device polls, fetches wrapped blob, unwraps, imports non-extractable. Session is destroyed. TTL 5 minutes.

Server sees: an ephemeral public key and an opaque blob. This is the same shape as Signal's device linking, and it works.

**Recovery.** A 12-word BIP39 phrase shown exactly once at signup. Argon2id (via `hash-wasm`; WebCrypto has no Argon2) derives a wrapping key, `wrapped_vault_recovery` sits in Postgres. Lose all devices, type the phrase, you're back. Without this, one lost phone means total data loss, and you will be the one who has to explain that to the other nine people.

**Per-item encryption**

- **Text/link:** AES-256-GCM, random 96-bit IV, AAD binds `item.id || kind || schemaVersion` so ciphertext can't be replayed into another slot. Stored as `bytea` inline when under 64 KB.
- **Blobs:** one random `FileKey` per file. File split into 1 MiB chunks, each chunk AES-GCM'd with `IV = base_iv || chunk_index` (counter, never reused), and a final tag over `chunk_count` so truncation is detectable. Chunking gives you resumability and streaming decrypt without buffering a 100 MB file in memory. `FileKey` wrapped with `VaultKey`, stored in Postgres.
- **Metadata is also encrypted.** Filename, MIME type, thumbnail, and text preview all go in a separate encrypted envelope. The server learns only: owner, byte size, timestamps, kind.

**Sending to another user**

Each user publishes an identity ECDH P-256 public key. Sender generates a one-off `ItemKey`, encrypts the payload, does ECDH(ephemeral private, recipient public) → HKDF → wraps `ItemKey`, stores `wrapped_key` + `eph_pub` on the item. Recipient unwraps with their identity private key (which came out of their own vault).

Trust-on-first-use, with a **key fingerprint shown in the UI** so people can verify out of band. Ten people who know each other: adequate. Log a loud warning if a peer's identity key ever changes.

**Consequence to accept:** no server-side search. Search runs client-side over the decrypted IndexedDB cache. For this volume, genuinely fine.

### Authentication

**Passkeys (WebAuthn), discoverable credentials.** This is the answer to "simple and secure" — it is simultaneously the simplest login (one Face ID tap, no username typed) and the strongest (phishing-resistant, origin-bound, nothing to leak from your DB). Use `@simplewebauthn/server` + `/browser`.

- Signup: redeem invite → create passkey → generate vault → show recovery phrase → claim a seat.
- Login: usernameless. Browser offers the resident credential; one tap.
- Every passkey is a **device row**. Revoking a device is a real operation with real consequences.
- Session: `httpOnly; Secure; SameSite=Lax; Path=/` cookie holding an opaque 256-bit token (not a JWT — you want instant revocation). Rotate on privilege change. 30-day sliding expiry, hard 90-day cap.
- **No password fallback, ever.** A password reset flow is a bypass of everything above. Recovery phrase covers the lost-device case.

### Invite-only, hard cap of 10

Two separate mechanisms, because they enforce different things.

**Invites:** 32 random bytes, base64url, shown once. Only `sha256(token)` is stored — treat it like a password. Single use, 72-hour expiry, optionally bound to a label. Admin-generated. Revocable.

**The cap:** enforce it structurally, not with a `COUNT(*)` check that races.

```sql
create table seats (
  seat_no    smallint primary key check (seat_no between 1 and 10),
  user_id    uuid unique references users(id) on delete set null,
  claimed_at timestamptz
);
-- pre-seed exactly 10 rows at migration time
```

Claiming a seat is one atomic statement:

```sql
update seats set user_id = $1, claimed_at = now()
where seat_no = (select seat_no from seats where user_id is null
                 order by seat_no limit 1 for update skip locked)
returning seat_no;
```

Zero rows returned means full. No race, no application-level counter to drift, and removing a user frees a seat by construction. The eleventh user is impossible by schema, not by convention.

### Upload gating

The capability question is subtler than "can they upload." Pasting a screenshot **is** an upload. Draw the line at storage, not at gesture:

| Item type | Where it lands | Requires `can_upload` |
|---|---|---|
| text, link (≤64 KB) | Postgres, inline ciphertext | No |
| image, file | R2 | **Yes** |
| anything, sent P2P only | nowhere — DataChannel, never persisted | **No** |

That last row is a genuinely nice resolution. A user without upload rights can still fire an image straight to another online device over WebRTC, because it never touches your storage and therefore costs you nothing. It makes the P2P path meaningful rather than an optimisation, and it makes the permission rule honest: the thing being gated is *your disk*, not their behaviour.

**The upload flow, enforced server-side at every hop:**

1. `POST /api/uploads/intent` → Vercel checks `can_upload`, remaining quota, per-file cap.
2. Vercel mints a **capability token**: EdDSA-signed JWT, 60-second TTL, scoped to one server-generated object key and one max byte count. Client never chooses the R2 key.
3. Client `PUT`s chunks to the Worker at `/upload`. Worker verifies the signature, enforces `Content-Length` against the token's cap, streams to R2 via binding.
4. `POST /api/uploads/commit` → Vercel `HeadObject`s to confirm real size, then inserts the row and increments `storage_used_bytes` in the same transaction.

**Why a Worker and not a presigned S3 URL:** a presigned PUT cannot reliably cap upload size, and this keeps R2 credentials out of Vercel entirely. The Worker holds an R2 *binding*, not a key. Uncommitted blobs older than 1 hour get swept by cron.

**Approval workflow:** `upload_requests` table with a partial unique index so one user can't spam multiple pending requests. Admin approves with a quota grant, not a boolean. Every decision hits the audit log.

### The rest of the security checklist

- **CSP** with per-request nonces, `strict-dynamic`, `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`. Enable Trusted Types.
- **CSRF:** `SameSite=Lax` + explicit `Origin` header check on every mutating route. Both, not either.
- **Rate limiting** in the Durable Object (already stateful, so it's free): token bucket per user on sends, per IP on auth endpoints.
- **Strip EXIF client-side before encryption.** GPS in a shared screenshot is a real leak and the server can't help you once it's ciphertext.
- **Downloads** always `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`. Never render a user blob inline at your origin. Decrypt to a blob URL client-side instead.
- **R2 object keys are random UUIDs**, never derived from filename or user input.
- **Audit log** for every privileged action: invite issued/redeemed, upload approved/denied, device revoked, user removed. Append-only.
- **Web Push payloads carry no plaintext.** "New item from Rishi" and nothing more; the client fetches and decrypts on open.

---

## 1.4 Data model

```sql
create extension if not exists pgcrypto;
create extension if not exists citext;

create type user_role  as enum ('admin', 'member');
create type item_kind  as enum ('text', 'link', 'image', 'file');
create type req_status as enum ('pending', 'approved', 'denied', 'withdrawn');

create table users (
  id                     uuid primary key default gen_random_uuid(),
  handle                 citext unique not null,
  display_name           text not null,
  role                   user_role not null default 'member',
  can_upload             boolean not null default false,
  storage_quota_bytes    bigint  not null default 0,
  storage_used_bytes     bigint  not null default 0,
  identity_pub           jsonb,           -- ECDH P-256 public JWK
  wrapped_vault_recovery bytea,           -- vault key under recovery-phrase key
  recovery_salt          bytea,
  suspended_at           timestamptz,
  created_at             timestamptz not null default now()
);

create table seats (
  seat_no    smallint primary key check (seat_no between 1 and 10),
  user_id    uuid unique references users(id) on delete set null,
  claimed_at timestamptz
);

create table devices (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  label         text not null,
  platform      text,
  credential_id bytea unique not null,     -- WebAuthn
  public_key    bytea not null,
  sign_count    bigint not null default 0,
  transports    text[],
  aaguid        uuid,
  backed_up     boolean,
  last_seen_at  timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now()
);

create table sessions (
  token_hash bytea primary key,            -- sha256 of opaque 256-bit token
  device_id  uuid not null references devices(id) on delete cascade,
  expires_at timestamptz not null,
  last_used  timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table invites (
  id          uuid primary key default gen_random_uuid(),
  token_hash  bytea unique not null,
  created_by  uuid not null references users(id),
  note        text,
  expires_at  timestamptz not null,
  redeemed_by uuid references users(id),
  redeemed_at timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);

create table blobs (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references users(id) on delete cascade,
  r2_key       text unique not null,       -- random, server-generated
  byte_size    bigint not null,
  chunk_size   int not null,
  chunk_count  int not null,
  sha256       bytea not null,             -- over ciphertext
  state        text not null default 'pending',  -- pending | committed
  created_at   timestamptz not null default now(),
  committed_at timestamptz
);

create table items (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references users(id) on delete cascade,
  sender_id       uuid references users(id),   -- null = from self
  kind            item_kind not null,
  ciphertext      bytea,                       -- inline, small text only
  meta_ciphertext bytea not null,              -- {filename, mime, preview, size}
  iv              bytea not null,
  wrapped_key     bytea,                       -- blobs + cross-user sends
  eph_pub         jsonb,                       -- sender ephemeral pub
  blob_id         uuid references blobs(id) on delete set null,
  byte_size       bigint not null default 0,
  pinned          boolean not null default false,
  expires_at      timestamptz not null,
  created_at      timestamptz not null default now()
);
create index on items (owner_id, created_at desc);
create index on items (expires_at) where pinned = false;

create table upload_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  reason        text not null,
  status        req_status not null default 'pending',
  decided_by    uuid references users(id),
  decided_at    timestamptz,
  decision_note text,
  granted_bytes bigint,
  created_at    timestamptz not null default now()
);
create unique index one_pending_per_user
  on upload_requests (user_id) where status = 'pending';

create table pairing_sessions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users(id) on delete cascade,
  new_device_pub jsonb not null,
  wrapped_vault  bytea,
  fingerprint    text not null,
  expires_at     timestamptz not null,      -- now() + 5 min
  created_at     timestamptz not null default now()
);

create table push_subscriptions (
  id        uuid primary key default gen_random_uuid(),
  device_id uuid not null references devices(id) on delete cascade,
  endpoint  text unique not null,
  p256dh    text not null,
  auth      text not null
);

create table audit_log (
  id           bigserial primary key,
  actor_id     uuid references users(id),
  action       text not null,
  subject_type text,
  subject_id   uuid,
  metadata     jsonb not null default '{}',
  ip           inet,
  created_at   timestamptz not null default now()
);
```

---

## 1.5 Transport and realtime

**One Durable Object per user vault**, id derived from `user_id`. It holds:

- Every live WebSocket for that user's devices, using the **Hibernation API** so idle sockets cost nothing.
- Presence (which devices are online right now — this drives the "Local" indicator).
- WebRTC signalling relay: `rtc.offer`, `rtc.answer`, `rtc.ice` envelopes routed between devices.
- Per-user rate limit buckets.

Fan-out messages: `item.created`, `item.deleted`, `device.joined`, `device.revoked`, `presence.changed`, `upload.decided`. Envelopes carry ciphertext; the DO never sees plaintext.

**Delivery strategy, in order:**

1. **Both devices connected and P2P negotiates** → DataChannel. Instant, LAN-speed, no storage cost.
2. **Recipient offline, or P2P fails** → server path. Text goes inline to Postgres, blobs to R2. Recipient gets a push notification.
3. **Text always also persists** to the server unless the user marks the item ephemeral. Persistence is the point; P2P is the fast path, not the only path.

**ICE:** STUN only. No TURN, because TURN means running a relay and paying for bandwidth. Roughly 80-90% of connections succeed on STUN alone; symmetric NAT and some mobile carriers will fail, and those fall through to the server path automatically. Do not surface this as an error.

**Note on P2P over mobile data:** if both devices are on cellular, STUN often fails and you're on the server path. That's expected. The LAN case — which is your actual use case, both devices on home Wi-Fi — is the one that works reliably.

---

## 1.6 Staying at zero cost

Verified current free-tier ceilings:

| Service | Free allowance | Your projected usage |
|---|---|---|
| R2 storage | <cite index="27-1">10 GB-month</cite> | 10 users × 500 MB quota = 5 GB worst case |
| R2 Class A (writes) | <cite index="27-1">1M requests/month</cite> | Hundreds |
| R2 Class B (reads) | <cite index="27-1">10M requests/month</cite> | Thousands |
| R2 egress | <cite index="22-1">Always $0, no time limit</cite> | — |
| Workers | <cite index="11-1">100k requests/day</cite> | Well under |
| Durable Objects | Free plan, SQLite backend only | 10 objects |
| Neon (via Vercel) | Free plan | Metadata only |
| Vercel Hobby | 100 GB bandwidth/month | No blobs pass through it |

**Guardrails to build in from day one, not retrofit:**

- Per-user quota, default 0, granted on approval. Never unlimited.
- Per-file cap 100 MB. Per-item text cap 64 KB.
- Blob TTL 7 days default, text TTL 30 days, pinning extends indefinitely but counts against quota.
- **R2 lifecycle rule** as a second line of defence, independent of your cron.
- Nightly cron on the Worker (Vercel Hobby caps you at one cron/day; Cloudflare gives you five) that prunes expired rows, deletes orphaned R2 objects, and sweeps uncommitted blobs older than 1 hour.
- A `/admin/usage` page showing R2 bytes and ops against the ceilings. Free tiers only stay free if you can see them.

---

## 1.7 Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 15 App Router, React 19, TypeScript `strict` + `noUncheckedIndexedAccess` | — |
| Package manager | pnpm workspaces + Turborepo | — |
| DB | Neon Postgres, `@neondatabase/serverless` | Vercel Postgres is gone |
| ORM | **Drizzle** | No engine binary, no cold-start penalty, SQL-shaped |
| Validation | **Zod** at every boundary — HTTP, WebSocket, DataChannel, env | Untrusted input arrives on four different transports here |
| Auth | `@simplewebauthn/server` + `/browser` | — |
| Crypto | WebCrypto, plus `hash-wasm` for Argon2id | Zero crypto deps you'd have to trust |
| Realtime | Cloudflare Worker + Durable Object (Hibernation API) | — |
| Client state | TanStack Query + a Zustand store for vault/session | — |
| Local cache | Dexie over IndexedDB | Offline reads, client-side search |
| Service worker | **Serwist** | `next-pwa` is unmaintained |
| Styling | Tailwind v4 + CSS custom properties for tokens | — |
| Primitives | Radix directly, styled by hand | shadcn defaults are exactly the look you don't want |
| Lint/format | **Biome** | One tool, no ESLint+Prettier config war |
| Tests | Vitest (unit — crypto and permissions), Playwright (E2E — pairing, upload gating) | — |
| Errors | Sentry free tier | — |

**Repo layout**

```
meownow/
├── apps/
│   ├── web/                  # Next.js → Vercel
│   └── edge/                 # single CF Worker: /ws (HubDO), /upload, /dl, cron
├── packages/
│   ├── db/                   # drizzle schema + migrations + seed
│   ├── crypto/               # isomorphic, zero-dep, 100% test coverage
│   ├── protocol/             # zod schemas for EVERY wire message, shared
│   ├── ui/                   # design primitives
│   └── config/               # tsconfig, biome, shared env schema
├── docs/
│   ├── ARCHITECTURE.md
│   ├── THREAT-MODEL.md
│   └── RUNBOOK.md            # rotate keys, revoke device, recover, restore
└── .github/workflows/        # typecheck, lint, test, drizzle drift check
```

`packages/protocol` is the keystone. Every message on every transport is a Zod schema defined once and imported by both sides. It is what stops the WebSocket and DataChannel paths from drifting apart.

---

## 1.8 Design direction

The product is a paste buffer on light paper. It is not a marketing kit and it does not follow the OS dark scheme.

**Theme.** Light is locked. `--paper` is cool silver-grey, `--surface` is white sheets, `--ink` is type and the one filled CTA. `--wash` is hover. `--muted` is meta. `--decay` is TTL warning only. Do not add `@media (prefers-color-scheme: dark)`. Set `color-scheme: only light`.

**Signature.** White sheets with a tinted shadow and a 1rem radius. Primary actions are ink pills of that radius, not inverted selection blocks. Hover uses `--wash`, not a full-row colour flip.

**Type.** Outfit is the product face: chrome, paste, timestamps, handles, forms, admin. Martian Mono is only for pairing codes, the 6-digit fingerprint, and the 12-word phrase. Never Inter.

**Layout.** Floating top bar. Landing is an asymmetric split (copy left, demo sheet right) that stacks under 768px. From 960px the signed-in clipboard is two panes in one sheet: write on the left, the tray on the right, timestamp gutter on each line. Below that it is one column; on a phone the composer sits at the bottom. Newest at top. ⌘K on a keyboard, Menu on a phone. TTL hairline under each item. Chrome carries one pairing entry pointing at `/pair`, labelled for what this browser most likely is. Forget is visible on every width. Inputs stay at 16px so iOS does not zoom.

**Motion.** Short ease-out on enter and press (`scale(0.98)`). New items may ease ~220ms. Grain is a fixed overlay. Respect `prefers-reduced-motion`.

**Copy.** Short. No emoji in chrome. The cat lives in the icon and the empty state. First-run copy names the next action in plain language. Do not say “vault” on a screen a guest has to complete.

**First-run.** One visible next action. The signed-out hero has one filled CTA: Continue with passkey. Join, recover, pairing, and first-admin enroll are hints on the home, not equal filled buttons. Guest Menu lists those onboarding paths with a one-line hint. A signed-in working browser's Menu is the product: clipboard, both pairing roles, admin, log out. Recover is not on that Menu — this browser is already a device. Recover stays on the guest Menu and on the new-browser screen, where the other device may be gone. After a passkey, this browser generates the 12 words on the same screen, with a working label while Argon2 runs. Pairing is only the next filled action when the account already has keys and this browser does not. An empty browser only offers Show a code. Recovery is the lost-every-device path. Pairing has two roles: the new browser shows a code, the working browser types it under Add a device. `/pair` presents both as cards and tags the one this browser should start with. Never hide the other role. A browser that guesses wrong must be one click from the right screen, never bounced with a refusal, and Menu lists both pairing roles. Invites are sent as a `/join?t=` URL, not a bare token.

**Forbidden:** Inter, purple-to-pink soup, dark auto-theme, glow, mesh, conic border, emoji buttons, unread shadcn, implying the server can read paste contents.

---

## 1.9 Build order

Each milestone is independently shippable and independently testable.

| # | Milestone | Done when |
|---|---|---|
| 0 | Monorepo, CI, env schema, Drizzle + migrations + seed, deploy skeleton to Vercel and Workers | Both deploy green from `main` |
| 1 | `packages/crypto` alone, with an exhaustive test suite | Every primitive tested incl. tamper-detection and truncation-detection |
| 2 | Auth: invites, passkeys, seats, sessions, admin bootstrap | 11th signup provably impossible |
| 3 | Vault: generation, QR device pairing with fingerprint confirmation, recovery phrase | Second device joins and reads item created on first |
| 4 | Text/link items: create, encrypt, store, WS fan-out, TTL, decrypt, copy | Two browsers stay in sync live |
| 5 | PWA: manifest, Serwist, Share Target, shortcuts, offline shell, Web Push | Android share sheet lands content in meownow |
| 6 | Uploads: request/approve flow, capability tokens, Worker gate, chunked encrypted upload, quota accounting | Non-approved user provably cannot write to R2 |
| 7 | P2P: signalling, DataChannel, LAN detection, ephemeral send | LAN transfer measurably faster than server path |
| 8 | Admin: users, devices, requests, audit log, usage dashboard | You can see R2 usage against the free-tier ceiling |
| 9 | Hardening: CSP, Trusted Types, rate limits, cron pruning, runbook | Threat model doc matches implementation |

Ship 0-4 first. That alone replaces WhatsApp for text and links, which is most of your actual traffic.

---

# Part 2 — The build prompt

Paste this into Claude Code, alongside this document, to start the repo.

---

You are the technical lead on **meownow**, a private, invite-only, end-to-end encrypted cross-device clipboard for exactly 10 people. Treat `meownow-spec.md` in the repo root as the authoritative specification. Read it fully before writing any code.

## Non-negotiables

1. **The server is untrusted.** It must never be able to read item content, filenames, MIME types, or previews. If a design choice would require plaintext server-side, the design choice is wrong. Flag it and propose an alternative rather than weakening the model.
2. **Every permission check happens server-side.** UI gating is a convenience, never an enforcement point. Specifically: a user without `can_upload` must be unable to write a byte to R2 even with a hand-crafted request.
3. **The 10-user cap is enforced by the `seats` table**, via the atomic `FOR UPDATE SKIP LOCKED` claim in the spec. Never by a `COUNT(*)` check.
4. **Zero recurring cost.** Every feature stays inside the free tiers listed in §1.6. If a proposal would exceed one, say so before building it.
5. **TypeScript strict**, `noUncheckedIndexedAccess`, no `any`, no non-null assertions outside tests. Every external boundary is Zod-parsed: HTTP bodies, WebSocket frames, DataChannel messages, and `process.env`.
6. **No passwords.** Passkeys plus a recovery phrase. Do not add a password fallback under any circumstance.

## Corrections to assumptions you may hold

- Vercel Postgres is discontinued. Use **Neon** via the Vercel Marketplace with `@neondatabase/serverless`. Never `@vercel/postgres`.
- Vercel Functions cannot hold WebSockets and cap request bodies at 4.5 MB. Realtime lives in a Cloudflare Durable Object; blobs go directly to R2 via a Worker, never through Vercel.
- Web Bluetooth cannot connect two browsers. "Local mode" means WebRTC resolving to LAN host candidates. Do not attempt Web Bluetooth.
- Browsers cannot monitor the clipboard in the background. Never write UI copy or docs implying automatic capture.

## How to work

- **Start with `packages/crypto` and `packages/protocol`.** Nothing else gets built until the crypto package is complete and its tests pass, including AEAD tamper detection and chunk-truncation detection. These are the two packages everything else depends on; getting them wrong later is expensive.
- **Follow the milestones in §1.9 in order.** Do not begin a milestone before the previous one's tests pass. Stop and report at each boundary.
- **Ask before deviating.** If the spec is ambiguous or wrong, say so and propose a fix. Do not silently pick an interpretation.
- **Write the doc alongside the code.** `docs/THREAT-MODEL.md` gets updated in the same commit as any change to the security model. `docs/RUNBOOK.md` covers: revoke a device, recover a vault, rotate the capability-token signing key, restore from backup.
- **Conventional commits, small and atomic.** One logical change per commit.

## What "done" means for any unit of work

- Types check, Biome passes, tests pass.
- Every new external input has a Zod schema in `packages/protocol`.
- New permission logic has a test proving the **denial** path, not only the allow path.
- No secret, key, or plaintext content appears in a log line.
- Error states have real copy explaining what happened and what to do next.
- Keyboard-reachable with a visible focus state. `prefers-reduced-motion` respected.

## Design constraints for any UI work

Read §1.8. Light is locked. Outfit for the product. Martian Mono only for pairing codes, fingerprints, and the 12 words. White sheets, ink CTAs, no OS dark flip.

First-run is a single visible path. Do not hide the next setup action in ⌘K. Invites are full `/join?t=` links.

Do not imply the server can read plaintext. No emoji in chrome. No unread shadcn defaults.

## Task 1

Set up the monorepo skeleton only — milestone 0. pnpm workspaces, Turborepo, the package structure from §1.7, TypeScript and Biome config, a Zod-validated env schema, Drizzle with the full schema from §1.4 plus an initial migration and a seed that creates the 10 `seats` rows and bootstraps the admin user, `wrangler.toml` for the Worker with R2 and Durable Object bindings, and a GitHub Actions workflow running typecheck, lint, test, and a Drizzle schema-drift check.

No application logic yet. When the skeleton deploys green to both Vercel and Cloudflare, stop and report.

---

## Open decisions for you

Four things I picked a default for. Change them if you disagree:

1. **Personal vault per user**, with optional direct sends between users. The alternative — one shared clipboard all 10 people see — is simpler but changes the crypto substantially. Say now if that's what you meant.
2. **iOS is a second-class citizen** (no Share Target). The iOS Shortcut workaround is documented but not built in v1.
3. **STUN only, no TURN.** ~10-20% of P2P attempts silently fall back to the server path.
4. **500 MB per user, 100 MB per file, 7-day blob TTL.** Sized to keep 10 users inside R2's 10 GB.
