# Threat model

Adversary: anyone outside the 10 seats; a compromise of Vercel, Neon, or R2; a leaked link. Out of scope: a fully compromised client device, or an admin misbehaving at the metadata layer.

Design principle: the server is an untrusted courier. It can route, expire, and account for content without reading it.

This document is a stub. Update it in the same commit as any change to the security model (`docs/SPEC.md` §1.3).
