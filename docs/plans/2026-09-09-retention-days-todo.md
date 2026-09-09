# Per-user retention days

**Parked 2026-09-09. Not locked. Do not implement. Do not add a milestone.**

This is **not** Account Reset deadlines (shipped separately: one tap sets stored `expires_at` to now + 30 days). This parked item is a lasting per-user day grant, like quota.

House defaults stay **30 days for text/links, 7 for images/files**. Quota stays its own 25–100 MB grant. This is only “ask for more days,” the same kind of ask as upload access, decided later.

## Intent (still thinking)

A member asks for a day count. Admin approves, denies, or grants a **different** number (they ask 365, you give 70). The grant is **that member only**. After a grant, **one N** for every stored kind is enough. Existing notes keep the deadline they already have. Playground ignores this. Pin stays unbuilt.

## Do not build a second product

Do not add `retention_requests`, `/api/retention/*`, a second `/access` form, or two pending queues. When this comes back, extend the **existing** upload request with optional days and `users.retention_days`. One pending row. Server still rejects a crafted `expires_at` past the allowed window. 365 days × file quota is more R2 storage-months; the grant is the control.

Shape, range, and copy are not decided. Come back here; do not invent from chat.
