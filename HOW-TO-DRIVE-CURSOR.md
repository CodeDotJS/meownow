# How to drive Cursor on this project

Delete this file once the repo is running. It is setup instructions, not project documentation.

## Install

Copy into an empty repo root:

```
AGENTS.md
docs/SPEC.md
.cursor/rules/00-invariants.mdc
.cursor/rules/10-crypto.mdc
.cursor/rules/20-db.mdc
.cursor/rules/30-api.mdc
.cursor/rules/40-edge.mdc
.cursor/rules/50-ui.mdc
.cursor/rules/60-workflow.mdc
```

`git init`, commit, open in Cursor. Verify rules are loading: Settings → Rules should list all seven. In a chat, the active ones appear above the composer.

## Why this shape instead of one big file

Pasting `SPEC.md` into chat works for one session and then decays. Rules persist across sessions and load automatically.

Only `00-invariants.mdc` loads on every request, which is why it is deliberately short. The rest are glob-scoped and load only when Cursor touches a matching file: edit something in `packages/crypto/` and the crypto rules attach themselves. `60-workflow.mdc` is description-matched, so it surfaces when you ask what to build next.

`AGENTS.md` is redundant with the rules on purpose. Cursor's Agent mode reads it reliably, and it keeps the project portable if you ever point another tool at it.

`docs/SPEC.md` stays in the repo as the long-form reference. `@`-mention the section you need rather than the whole file.

## First message

Open Composer in Agent mode:

> Read `AGENTS.md` and `docs/SPEC.md` §1.4 and §1.7. Then execute milestone 0 only: monorepo skeleton with pnpm workspaces and Turborepo, the package structure from §1.7, TypeScript and Biome config, a Zod-validated env schema, Drizzle with the full schema from §1.4 plus an initial migration and a seed creating the 10 `seats` rows and bootstrapping the admin user, `wrangler.toml` with R2 and Durable Object bindings, and a GitHub Actions workflow running typecheck, lint, test, and a Drizzle drift check.
>
> No application logic. Stop and report when it deploys green to both Vercel and Cloudflare.

## Working rhythm

**One milestone per Composer session.** Start a fresh session at each boundary. Cursor degrades noticeably once a session accumulates a large diff, and the milestones are sized to fit.

**Milestone 1 before anything else.** `packages/crypto` gets built and fully tested before a single route exists. It is what everything else depends on and it is the expensive thing to get wrong.

**Ask for the plan first on anything non-trivial.** "Plan milestone 3, do not write code yet." Read it, correct it, then approve. This catches spec misreadings before they become a 40-file diff.

**Review the denial paths yourself.** The rules tell Cursor to test that unauthorised actions fail, but this is the property most worth verifying by hand. Specifically: try uploading as a user with `can_upload = false` using curl, not the UI. Try claiming an 11th seat.

**When Cursor argues with a rule, check who is right.** Sometimes the spec is wrong. Update `docs/SPEC.md` and the relevant `.mdc` in the same commit, so the two never disagree.

## Things to watch for

- Cursor will reach for `@vercel/postgres` from training data. The invariants rule says not to, but check the imports.
- It will try to buffer whole files in memory during upload. Enforce streaming.
- It will produce a generic dashboard UI on the first attempt regardless of `50-ui.mdc`. Push back once with a reference to the two signature ideas and it usually lands.
- It will add a "forgot password" flow if you let it near auth without the rules attached. Confirm `00-invariants.mdc` is active on those files.
