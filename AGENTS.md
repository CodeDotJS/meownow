# meownow

A private, invite-only, end-to-end encrypted cross-device clipboard. You copy something on one device and paste it on another. Text, links, images, files.

Full specification: `docs/SPEC.md`. It is authoritative. Read the relevant section before implementing. There is no `meownow-spec.md` in the repo root; if a prompt refers to that name, it means this file.

## Commands

```bash
pnpm install
pnpm dev              # Next.js app + Worker via wrangler dev
pnpm typecheck        # tsc across all packages
pnpm lint             # biome check
pnpm test             # vitest
pnpm test:e2e         # playwright
pnpm db:generate      # drizzle-kit generate
pnpm db:migrate       # apply migrations
pnpm db:seed          # admin bootstrap
```

CI runs typecheck, lint, test, and a Drizzle schema-drift check on every push.

## Architecture

```
apps/web/          Next.js 15 App Router → Vercel. Identity, authorization,
                   metadata. Never touches file bytes.
apps/edge/         One Cloudflare Worker: /ws (HubDO), /upload, /dl, cron.
                   Enforces policy, never decides it.
packages/crypto/   Isomorphic WebCrypto. Zero deps except hash-wasm.
packages/protocol/ Zod schemas for every wire message. Shared by both sides.
packages/db/       Drizzle schema, migrations, seed.
packages/ui/       Design primitives.
packages/config/   tsconfig, biome, env schema.
```

Storage: Neon Postgres for metadata and small ciphertext. Cloudflare R2 for blob ciphertext.

`packages/protocol` is the keystone. Every message on every transport is defined once and imported by both sides. It is what stops the HTTP, WebSocket, and DataChannel paths from drifting.

## Constraints you must not violate

- **The server is untrusted.** It must never see plaintext content, filenames, MIME types, or previews. If an approach requires plaintext server-side, stop and flag it.
- **All authorization is server-side.** UI gating is convenience, never enforcement. A user without `can_upload` must be unable to write a byte to R2 even with a hand-crafted request.
- **Membership is invite-only.** There is no public signup and no numeric seat cap. An unused invite is the only way in. Flag free-tier cost if invites grow past a small group. `/play` is not a seat; those notes, including local images, never leave this browser.
- **No passwords.** Passkeys plus a recovery phrase. Never add a fallback.
- **Zero recurring cost.** Everything stays inside free tiers. Flag anything that would exceed one before building it.

## Corrections to common assumptions

- Vercel Postgres was discontinued in June 2025. Use Neon via the Vercel Marketplace with `@neondatabase/serverless`. Never `@vercel/postgres`.
- Vercel Functions cannot hold WebSockets and cap request bodies at 4.5 MB. Realtime lives in a Durable Object; blobs go straight to R2 via the Worker.
- Web Bluetooth cannot connect two browsers. It only implements the GATT central role. "Local mode" means WebRTC resolving to LAN host candidates.
- Browsers cannot monitor the clipboard in the background. No such event exists. Never write code or copy implying automatic capture.
- `next-pwa` is unmaintained. Use Serwist.

## Code style

TypeScript strict, `noUncheckedIndexedAccess`, no `any`, no non-null assertions outside tests. Biome for lint and format, not ESLint or Prettier. Conventional commits, one logical change each.

Every external input is Zod-parsed: HTTP bodies, WebSocket frames, DataChannel messages, `process.env`.

## Design

See `docs/SPEC.md` §1.8 and `.cursor/rules/50-ui.mdc`. Light is locked. Outfit for the product; Martian Mono only for pairing codes, fingerprints, and the 12 words. First-run is one visible path; invites are `/join?t=` links; pairing keeps both roles reachable (`/pair` tags the likely one); do not say “vault” on a guest setup screen.

## Working method

Follow the milestones in `docs/SPEC.md` §1.9 in order. Do not begin one before the previous milestone's tests pass. Stop and report at each boundary.

If the spec is ambiguous or wrong, say so and propose a fix. Do not silently pick an interpretation.
