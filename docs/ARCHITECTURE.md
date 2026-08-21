# Architecture

meownow splits identity from bytes.

- **Vercel / Next.js** (`apps/web`) owns identity, authorization, and metadata. It never touches file bytes.
- **Cloudflare Worker** (`apps/edge`) owns WebSockets (HubDO), `/upload`, `/dl`, and cron. It verifies capability tokens minted by Vercel. It never decides policy.
- **Neon Postgres** stores metadata and small ciphertext (text/links ≤ 64 KB).
- **R2** stores blob ciphertext. Private bucket. No public access.

Fill this document as milestones 1–9 land. Source of truth: `docs/SPEC.md` §1.2.
