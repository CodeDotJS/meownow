# Offline clipboard and sync control

Locked 2026-08-25. Implementation plan: `docs/plans/2026-08-25-offline-sync.md`.

## Product

This browser must open the tray without a network. Text and links can be written here. The server is still untrusted: seal first, store ciphertext, never plaintext.

**Sync** is a setting on this browser, on or off, online or offline. Default **on**.

- **On** — same persist path as today when the network is up. If the network is down, sealed notes wait in a local queue and flush themselves when the browser is online again. No extra tap. A short status is enough (`3 notes synced`).
- **Off** — nothing is written to Neon until the user says so, including on Wi‑Fi. Each unsynced note has **Sync**. If more than one is waiting, the tray also has **Sync all**.

Coming online does not change the rule. On → drain the queue. Off → buttons.

Turning Sync **on** drains notes that were held. Turning it **off** does not pull already-synced notes back off the server. Forget is how a stored note leaves Neon.

## Out of scope

- File and image upload while offline or while Sync is off. Those still need `can_upload`, a capability token, and R2. The File control stays gated; a status explains why.
- Live only. Still means skip the store; another device must be live. Fail closed if mesh and hub are both down. Live only never enters the outbox.
- Client-side search, Dexie, TanStack Query, Zustand, pin UI (copy mentions pin; the control is not in the tray yet).
- Worker / Durable Object schema for create/delete. Quota, `can_upload`, `POST /api/items`, and `PATCH /api/items/:id` stay on Vercel. The Worker must parse `item.updated` the same way it parses `item.created`.
- File and image bytes. Text/link notes can be replaced in place (`item.updated`); files cannot.

## Local data

Do not add Dexie. Extend the existing IndexedDB style (vault is already `meownow` / `vault`).

New database `meownow-items` (keep vault DB v1 untouched):

- `meta`: `{ syncEnabled: boolean, lastMe: { id, handle, displayName, role, canUpload, hasVault } | null }`
- `records`: keyed by item id. Ciphertext envelope (`id`, `kind`, `ciphertext`, `metaCiphertext`, `iv`, `byteSize`, `createdAt`, `expiresAt`) plus `state: "queued" | "held" | "synced" | "dirty"`. `dirty` is a note already on the server whose local ciphertext is newer; flush uses `PATCH /api/items/:id`.

Never persist plaintext. Decrypt into React state with the vault key already in IDB, same as `openItem` today.

`lastMe` is so chrome and the clipboard can render when `GET /api/auth/me` fails. It is not a session. Mutating routes still need the cookie. If there is no vault in IDB, show the landing / sign-in path, not a ghost tray.

Account delete and stale-vault wipe (`dropStaleLocalVault`) must clear `meownow-items` as well as vault keys.

## Persist decision

Pure function, tested:

```
ephemeral → live (no outbox)
sync off  → hold
online    → post; if fetch status 0, queue
offline   → queue
```

A 4xx/5xx from `POST /api/items` is not a queue. Keep today’s rollback (remove the optimistic row, restore draft, show the code) except when the failure is no network (`status: 0` / `request_failed` from `postJson`).

`createItem` with the same id is already a no-op. Sync / undo may POST the same payload again.

Forget:

- `queued` / `held` — delete the local row only. Do not call `DELETE /api/items`.
- `synced` or unknown remote — today’s delete + mesh `item.deleted`.
- Live only — mesh only, unchanged.

## Hydration

On load, if the vault key exists:

1. Read local records, drop expired, decrypt, show the tray.
2. If `GET /api/items` works, merge remote list with `mergeRemoteItems`, treating `queued`/`held` ids as `pending` so a refresh does not wipe unsynced notes. Upsert remotes as `synced`.
3. If the list request fails, keep the local tray. Do not empty it.

`pendingRef` in `page.tsx` becomes the outbox ids, not an in-memory-only set.

## UI

- **Account** holds the Sync switch (this browser). Quiet, not a second ink CTA on the hero.
- Clipboard: unsynced text/link rows show **Sync**. Two or more unsynced → **Sync all** on the tray.
- Hub chrome stays presence. Rename the not-live tooltip from “Syncing…” to “Connecting…” so it is not this feature.
- `/~offline` stays the document fallback for uncached routes. The installed shell should open `/` from the precache and then read IDB. Do not cache `/api/*`.

## Tests

Denial and merge paths in unit tests, not only the happy flush. No Worker deploy. Neon unchanged.
