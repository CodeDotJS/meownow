# Playground

Locked 2026-08-31. Not shipped. SPEC and related docs updated locally to match. Do not commit or push until `/play` is verified.

**Locked 2026-08-31.** Playground notes never go to Neon, R2, or the hub. They exist so a signed-out person can see how the clipboard looks and feels. They are not a stored clipboard.

**Locked 2026-08-31.** The playground lives at `/play`. After join, playground notes are discarded. The cap is five **current** notes; Forget frees a slot. Do not commit or push until `/play` is verified locally.

**Locked 2026-08-31.** The signed-out hero always shows Playground and Continue with passkey next to each other. Guest chrome and Menu always list both. A signed-in browser stays on the real clipboard; `/play` still sends it home.

## Product

A guest can use the clipboard in this browser without a passkey and without an invite. They can keep **five text or link notes** here, on this device, so the composer and tray feel real. The origin does not persist them. Everything that needs an account — other devices, the store, files, Live only, Sync, admin — stays behind a `/join?t=` invite.

An invite is still the only way to become a member. Playground is not a seat, not a signup, and not a public account. “Referral link” in the request means that existing invite URL. Do not add a second token, a share-to-signup loop, or a way for a guest to mint invites.

The landing demo sheet stays fake. Playground is a real composer and tray.

## Why this shape

The invariants collide if playground notes leave the browser:

- **Invite-only.** An unused invite is the only way in. A server-side anonymous user is a public signup with a different name.
- **The server is untrusted.** A guest write is either plaintext on Neon (forbidden) or a vault with no passkey, no recovery wrap, and no pairing story.
- **Zero recurring cost.** Anonymous POSTs, hub sockets, and R2 would be free-tier abuse. Five notes per browser is cheap only if the origin never stores them.
- **Authorization is server-side.** UI gating a “guest” who can still hit `/api/items` is not a playground; it is a hole.

So playground is **this browser only**. No Neon row, no R2 object, no hub frame. The write helper refuses an 11th note. The API, Worker, hub, and R2 stay member-only. A hand-crafted request from a guest is `401` the way it is today.

## Approaches not taken

**Anonymous Neon row + throwaway user.** Breaks invite-only. Needs rate limits, a prune story, and a fake vault. Reject.

**Plaintext `POST /api/play`.** The server would see notes. Reject.

**Landing demo only.** Already exists. It is canned copy, not a tray the guest owns. Not this feature.

**Playground as a full account with a 10-note quota.** That is membership without an invite. Reject.

## What a guest may do

In this browser, with no session:

- Type and send text or link notes (markdown, `:name:` shortcodes, Tab indent).
- See them in the tray. Copy, Open, Edit, Forget.
- Keep at most five **current** notes. Forget frees a slot. Edit does not consume a new one. Lifetime send count is not a cap.
- Use the same defaults as a new member for clip-long-notes (off), tap-to-copy (off), and Tab indents (on). Those prefs stay in the playground store, not Account.

The 11th send does not queue, does not encrypt-for-later, and does not talk to the network. The composer says they are at the cap and points at Join / Ask.

## What requires an invite

A session plus a vault. Until then, hide these in the playground chrome and **deny them on the server** (already true today; keep it that way):

| Feature | Why it waits |
|---|---|
| Passkey, Account, log out | Membership |
| Pairing, recover, second device | Needs VaultKey wrap |
| Hub, presence, Live only | Needs a user Durable Object |
| Sync / Sync all / queue flush | Needs `POST /api/items` |
| Images, files, upload quota | `can_upload` and R2 |
| Share Target persist | Signed-in encrypt + POST |
| Web Push | Device + VAPID |
| Invites, People, Requests, usage | Admin / member |

Ask for an invite (`/ask`) and Join (`/join`) stay guest paths. First-admin enroll stays as it is. Playground does not replace them.

Sign in with a passkey that already lives on this browser opens the real clipboard, not the playground.

## Storage (locked)

Nothing is written to Neon. Nothing is written to R2. The Worker is not involved.

A dedicated IndexedDB database, name `meownow-play`, so the tray survives a refresh in this browser. That is a look-and-feel cache, not the product store. Do not reuse `meownow-items`. A later sign-in must not treat playground rows as vault ciphertext, and a guest must not see a member’s cache.

Do not invent a playground VaultKey or a recovery wrap. These notes are not an account. Keep them as ordinary local records the tray already knows how to render (text/link source, timestamps). Clearing site data wipes them. That is expected; say so once.

Copy: they stay on this browser so you can try the tray. Do not say “vault.” Do not say “sealed before it leaves.”

Cap enforcement lives in the playground write helper, not only in the button. Tests: 5 succeed, 6th throws, Forget then send succeeds, a guest `POST /api/items` is still `401`. The cap is UX. A console or IndexedDB edit on this device is not a breach of the store. Do not add a server counter for playground notes.

## First-run and route (locked)

The canned landing demo on `/` stays fake.

The signed-out hero always shows two filled buttons in one row: **Playground** → `/play`, and **Continue with passkey** → `/login`. Guest chrome is About, Playground, Sign in, Menu. Guest Menu always lists Playground. Join, Ask, recover, pairing, and first-admin stay hints.

A signed-in browser does not see that hero. If it opens `/play`, send it to the real clipboard.

Do not use `/?play=1`. Do not mount the live tray on `/` in place of the landing split.

## After they get an invite

Redeem `/join?t=` as today. New member, passkey, 12 words, vault.

Playground notes do **not** upload themselves. They were never in Neon. When a vault exists on this browser, drop `meownow-play`. No keep offer. Never `POST` playground text as a member item.

If they already had keys on this browser and open `/play`, show the real clipboard instead (redirect or replace). Playground is for a browser with no session and no local vault.

## Copy

Short. No emoji chrome. No “vault.” No “the server cannot read these” as a playground boast — the server never received them.

Suggested surface:

- Title: Playground
- Lead: “Five notes in this browser. An invite unlocks the rest.”
- Count: tray chip `n/5`, not a composer footnote
- Forget / errors: tray notice, same as the member Forgotten line
- At cap: centered sheet, cat, “That’s five.” Ask for an invite / I have a link / Close
- Empty: same cat as the member empty state; do not invent a second mascot.

About stays 20 questions. Fold playground into `about-in` or `about-install`. Do not add a 21st FAQ.

## Spec and docs this will require

When locked, edit in the same spirit as other product changes (one concern per commit):

- `docs/SPEC.md` §1.3 / invariants: unused invite is still the only **member**. Playground is not a member.
- `docs/SPEC.md` §1.8 First-run + Layout: how a guest reaches `/play`, ten-note cap, no files / Live only / Sync.
- `docs/SPEC.md` §1.9: a later milestone (after 9), done when a guest can write 5 local notes and a guest POST is still denied.
- `docs/THREAT-MODEL.md`: playground notes are a this-browser look-and-feel cache only; never Neon / R2 / hub; not a session; device compromise still out of scope; no new ingest route.
- `.cursor/rules/50-ui.mdc` and `AGENTS.md` / `00-invariants.mdc`: playground is local; invite is still the only seat.
- `apps/web/lib/ui/about-copy.ts`, `README.md`: one sentence each.

About and README wait until `/play` exists so guest copy is not a lie. Historical milestone plans stay snapshots. No git write until `/play` is verified.

## Threat notes

Adversary (a) in the current model is “anyone without a valid invite or session.” Playground lets that person write notes **to their own browser**. That does not widen what they can write to Neon, R2, or another user.

XSS on the origin can read `meownow-play` the same way it can use a non-extractable VaultKey. Same out-of-scope device/XSS class. Do not store playground notes in `localStorage`. Do not log note text.

No new Worker route. No Share Target into the playground (that would be a plaintext inbox without a member encrypt step). If a guest hits `/share`, keep today’s signed-in-or-drop behavior.

## Tests (when we build)

- Write helper: 5 ok, 6th denied, Forget then write ok, edit does not bump the count.
- Guest `POST /api/items`, `/upload`, hub ticket: still denied.
- Playground DB is not read as `meownow-items`.
- After join + vault, playground rows are not POSTed; discard is the default.
- About copy still has 20 FAQs and does not say vault on the playground path.
- No Worker or protocol schema change.

## Out of scope

- Shipping or pushing `/play` before that route is verified locally
- Implementing until you ask to build `/play`
- Files, images, Live only, pairing, push, Share Target
- Server-side guest quota, anonymous users, or any Neon/R2 write for a guest
- A new referral / viral invite type
- Auto-migrating playground notes into the member store
- Changing invite-only membership
- WYSIWYG, a second landing, or dark theme

## Open questions

None. Locked:

1. Hero CTA: Playground and Continue with passkey, always, side by side.
2. Route: `/play`.
3. Keep-on-join: always discard.
4. Five: current notes; Forget frees a slot.

Build `/play` when asked. No git commit or push until that route is verified.
