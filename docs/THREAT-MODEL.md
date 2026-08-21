# Threat model

Adversary: anyone outside the 10 seats; a compromise of Vercel, Neon, or R2; a leaked link. Out of scope: a fully compromised client device, or an admin misbehaving at the metadata layer.

Design principle: the server is an untrusted courier. It can route, expire, and account for content without reading it.

## End-to-end encryption (milestone 1)

All item content, metadata envelopes, and file bytes are AES-256-GCM on the client. AAD binds `item.id`, `kind`, and `schemaVersion`, so ciphertext cannot be replayed into another slot. Blob chunks use `IV = base_iv || chunk_index`; a trailer over `chunk_count` detects truncation.

VaultKey is AES-256-GCM. After `createVault()`, the working key is **non-extractable**. WebCrypto `wrapKey` requires an extractable subject, so recovery wrapping happens before that import. `extractableVaultKey` exists only so a later pairing wrap can proceed without `exportKey` of the live key. Milestone 3 must persist a device-wrapped copy and drop the extractable handle.

Recovery is Argon2id over a 12-word BIP39 phrase (`hash-wasm`). Pairing and directed sends use ECDH P-256 → HKDF-SHA256. Both pairing devices show a 6-digit fingerprint of the shared secret so the server cannot MITM silently.

The server sees: owner, size, timestamps, kind, opaque ciphertext, wrapped keys, ephemeral public JWKs. It never sees plaintext, filenames, MIME types, or previews.
