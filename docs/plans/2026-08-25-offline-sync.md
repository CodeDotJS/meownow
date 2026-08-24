# Offline clipboard and sync control Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Open and write text/link notes on this device with no network; Sync-on flushes the queue when online; Sync-off waits for per-note Sync or Sync all.

**Architecture:** Ciphertext outbox in IndexedDB (`queued` vs `held` vs `synced`). A pure `persistIntent` decides live / hold / queue / post. Vercel `POST /api/items` is still the only persist. The Worker is unchanged. Session snapshot in IDB is convenience for chrome, never authorization.

**Tech Stack:** Existing WebCrypto + IDB helpers (no Dexie), Vitest for policy/cache/merge, current `postJson`/`getJson` (`status: 0` already means offline).

**Design:** `docs/plans/2026-08-25-offline-sync-design.md`.

**Spec tensions:**

- Spec §1.7 lists Dexie for the local cache. Do not add it; the vault already uses a small IDB helper.
- About copy mentions pin; there is no pin control. Do not build pin here.
- Chrome currently says “Syncing…” for a down hub. Rename to “Connecting…” so it does not collide with Sync.

---

### Task 1: Persist intent (TDD)

**Files:**

- Create: `apps/web/lib/vault/persist-intent.ts`
- Test: `apps/web/lib/vault/persist-intent.test.ts`

**Step 1: Failing tests**

```ts
import { expect, test } from "vitest";
import { persistIntent } from "./persist-intent";

test("live only never enters the outbox", () => {
	expect(persistIntent({ ephemeral: true, syncEnabled: true, online: true })).toBe("live");
	expect(persistIntent({ ephemeral: true, syncEnabled: false, online: false })).toBe("live");
});

test("sync off holds even when online", () => {
	expect(persistIntent({ ephemeral: false, syncEnabled: false, online: true })).toBe("hold");
});

test("sync on queues when offline and posts when online", () => {
	expect(persistIntent({ ephemeral: false, syncEnabled: true, online: false })).toBe("queue");
	expect(persistIntent({ ephemeral: false, syncEnabled: true, online: true })).toBe("post");
});
```

**Step 2:** `pnpm --filter @meownow/web exec vitest run lib/vault/persist-intent.test.ts` — FAIL (module missing).

**Step 3: Minimal implementation**

```ts
export type PersistIntent = "live" | "hold" | "queue" | "post";

export function persistIntent(input: {
	ephemeral: boolean;
	syncEnabled: boolean;
	online: boolean;
}): PersistIntent {
	if (input.ephemeral) {
		return "live";
	}
	if (!input.syncEnabled) {
		return "hold";
	}
	return input.online ? "post" : "queue";
}
```

**Step 4:** Tests pass.

**Step 5:** Commit `test: decide whether a note is live, held, queued, or posted`.

---

### Task 2: Outbox records and flush policy (TDD)

**Files:**

- Create: `apps/web/lib/vault/outbox.ts`
- Test: `apps/web/lib/vault/outbox.test.ts`

Keep this module **pure** (no IDB). The IDB wrapper in Task 3 calls it.

Record shape:

```ts
export type OutboxState = "queued" | "held" | "synced";

export type CachedItem = {
	id: string;
	kind: "text" | "link";
	ciphertext: string;
	metaCiphertext: string;
	iv: string;
	byteSize: number;
	createdAt: string;
	expiresAt: string;
	state: OutboxState;
};
```

Failing tests to write:

- `unsynced(items)` → only `queued` and `held`, sorted newest first.
- `shouldAutoFlush({ syncEnabled, online, state })` is true only for `queued` when sync is on and online.
- Turning sync on: `held` becomes `queued` (`releaseHeld`).
- `markSynced` / `drop` by id.
- `dropExpired(items, now)` removes `expiresAt <= now`.
- `createItem` payload from a cached row matches `itemCreateRequestSchema` (no `createdAt`/`state` on the wire).

Implement the helpers. Run vitest. Commit `feat: model queued, held, and synced clipboard envelopes`.

---

### Task 3: IndexedDB cache (TDD with a memory fake)

**Files:**

- Create: `apps/web/lib/vault/item-cache.ts`
- Test: `apps/web/lib/vault/item-cache.test.ts`

Do not open real IndexedDB in unit tests (`noUncheckedIndexedAccess`, jsdom may be flaky). Extract `ItemCacheStore` interface: `getMeta`, `setMeta`, `put`, `getAll`, `delete`, `clear`. Memory implementation in the test file; IDB implementation in `item-cache.ts`.

Tests:

- Default `syncEnabled` is `true`.
- `lastMe` round-trips.
- Put queued, list, delete, clear.
- `clear` is what account-delete and stale-vault wipe call.

IDB: database name `meownow-items`, version 1, stores `meta` and `records`.

Also extend `dropStaleLocalVault` / account `clearVault` path to `clear` this cache. Test `isStaleLocalVault` stays as-is; add `clearItemCache` call next to `clearVault` in `local.ts` and `account/page.tsx`.

Commit `feat: persist sealed notes and sync preference in IndexedDB`.

---

### Task 4: Merge still keeps unsynced rows (TDD)

**Files:**

- Modify: `apps/web/lib/ui/merge-items.ts` only if needed
- Test: `apps/web/lib/ui/merge-items.test.ts` (create if missing; otherwise extend)

Existing `pending` already preserves local-only ids when the server list omits them. Add an explicit test: three held ids survive a remote list that does not include them; a tombstone still wins.

If the test already follows from current `mergeRemoteItems`, do not change production code. Commit `test: keep unsynced notes across a remote refresh` only if a new assertion is added.

---

### Task 5: Offline session snapshot (TDD)

**Files:**

- Modify: `apps/web/lib/ui/session.tsx`, `apps/web/lib/ui/app-frame.tsx`
- Create: `apps/web/lib/ui/session-cache.test.ts` for the pure bit if you extract `resolveSession({ networkMe, cachedMe, hasLocal })`

Behavior:

- `GET /api/auth/me` ok → set me, write `lastMe`, `dropStaleLocalVault`.
- Network fail (`status: 0`) and `hasLocal` and `lastMe` → use `lastMe` (do not treat as signed out).
- Network fail, no vault → `me = null` (landing).
- `401` with a live server → signed out; do not use `lastMe`.

`postJson`/`getJson` already return `status: 0` on fetch throw. Distinguish that from `401`.

Commit `fix: keep a signed-in tray when /api/auth/me cannot be reached`.

---

### Task 6: Wire send, Forget, and flush on the clipboard

**Files:**

- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/lib/p2p/send.ts` only if `shouldPersist` should stay ephemeral-only (prefer `persistIntent` at the call site, leave `shouldPersist` for live-only).

`sendPlain` after local optimistic row:

1. Live only → existing mesh/hub path. No cache write except we may skip IDB entirely (ephemeral must not survive refresh as a stored row; today’s in-memory + flag is enough).
2. `hold` → `put` state `held`. Do not `postJson`.
3. `queue` → `put` state `queued`. Do not `postJson`.
4. `post` → `put` state `queued` first (crash safety), `postJson`. Ok → `markSynced`. `status: 0` → leave `queued`. Other errors → delete cache row, rollback UI as today.

`online` = `navigator.onLine` plus `window` `online`/`offline` listeners. `status: 0` is also offline even if `navigator.onLine` lies.

On `online`, visibility, and after hub `hello`, if `syncEnabled`, flush all `queued` (not `held`) sequentially. Count successes for status copy. Continue after a single failure; surface `errorCode`.

`refreshItems`: if GET fails, decrypt cache and `setItems` from cache + in-memory ephemeral. If GET works, merge as today with pending = unsynced ids from cache.

Forget: if cache state is `queued` or `held`, skip `deleteJson`. Always drop the cache row.

Hydrate from cache before the first GET so the tray is not empty on a slow or dead network.

Do not queue files. `onFile` / File control: if `!navigator.onLine`, set status (add a local copy string, e.g. `Need a network to send a file.`). Sync-off: same — files are not held.

Commit `feat: queue or hold text notes until sync`.

---

### Task 7: Sync control UI

**Files:**

- Modify: `apps/web/app/account/page.tsx` — switch “Sync to other devices” / hint: “Off keeps new notes on this browser until you sync them.”
- Modify: `apps/web/app/page.tsx` — per-row **Sync** (quiet) on unsynced text/link; **Sync all** in the tray when `unsynced.length > 1`.
- Modify: `apps/web/lib/ui/app-frame.tsx` — hub tooltip `Connecting…` when not live.
- Modify: `apps/web/lib/ui/copy.ts` — optional status `3 notes synced`.
- Modify: `apps/web/lib/ui/about-copy.ts` — one FAQ line: Sync off stays on this device; Sync on writes the store when a network exists.
- Test: `apps/web/lib/ui/about-copy.test.ts` if it asserts exact FAQ text.
- Modify: `apps/web/app/~offline/page.tsx` — point at opening Home / the installed app, not a fake “local cache” claim unless cache is wired (after Task 6 it is true for `/`).

No second filled home CTA. No “vault” on this copy.

Toggling Sync **on** from Account calls `releaseHeld` then flush if online.

Commit `feat: let this browser hold notes until Sync`.

---

### Task 8: Service worker and spec

**Files:**

- Modify: `apps/web/app/sw.ts` — if `defaultCache` would cache API GETs, add a rule: network-only for `/api/` and Worker origins. Precache of `/` already exists.
- Modify: `docs/SPEC.md` — §1.2 IndexedDB cache is real; §1.7 Dexie is not required; first-run: Sync is an Account control, not a hero CTA; optional row in §1.9 as follow-on to milestone 5.
- Modify: `docs/THREAT-MODEL.md` — PWA section: local ciphertext cache + lastMe; plaintext still not on the server; device compromise remains out of scope.

Run: `pnpm --filter @meownow/web exec vitest run lib/vault lib/ui/merge-items.test.ts lib/ui/about-copy.test.ts`, `pnpm --filter @meownow/web exec tsc --noEmit`, `pnpm exec biome check` on touched files.

Worker: do not redeploy.

Commit `docs: describe the local ciphertext cache and Sync control`.

---

## Manual check (after code)

Installed PWA or production build (Serwist is disabled in `next dev`):

1. Sync on, airplane mode, three text notes → tray shows them. Online → they POST; other device receives; status mentions sync.
2. Sync off, online, three notes → each has Sync; Sync all sends all; People/Usage unchanged until then.
3. Forget a held note → gone locally, never appears on the other device.
4. File while offline → no R2 write.
5. Live only while offline → still fail closed, not queued.

## Done when

- Unit tests cover persist intent, outbox, cache fake, merge, and session fallback.
- A browser with a vault can open the tray with the network off.
- Sync on auto-flushes queued text/links; Sync off never POSTs until Sync / Sync all.
- `POST /api/items` remains the only persist; no plaintext in IDB; Worker untouched.
