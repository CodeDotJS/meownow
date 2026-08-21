import { expect, test } from "vitest";
import { decrypt, encrypt } from "./aead";
import { ARGON2_TEST } from "./recovery";
import { createVault, generateFileKey, unwrapFileKey, wrapFileKey } from "./vault";

const aad = { itemId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", kind: "text" as const };

test("createVault returns a non-extractable AES-GCM key", async () => {
	const vault = await createVault({ argon2: ARGON2_TEST });
	expect(vault.vaultKey.extractable).toBe(false);
	expect(vault.vaultKey.algorithm.name).toBe("AES-GCM");
	expect(vault.mnemonic.split(" ")).toHaveLength(12);
});

test("FileKey wrap/unwrap with VaultKey roundtrips", async () => {
	const vault = await createVault({ argon2: ARGON2_TEST });
	const fileKey = await generateFileKey();
	const wrapped = await wrapFileKey(vault.vaultKey, fileKey);
	const unwrapped = await unwrapFileKey(vault.vaultKey, wrapped);
	const plain = new TextEncoder().encode("blob");
	const sealed = await encrypt(fileKey, plain, { ...aad, kind: "image" });
	const opened = await decrypt(unwrapped, sealed, { ...aad, kind: "image" });
	expect(new TextDecoder().decode(opened)).toBe("blob");
});

test("a different vault cannot unwrap a FileKey", async () => {
	const a = await createVault({ argon2: ARGON2_TEST });
	const b = await createVault({ argon2: ARGON2_TEST });
	const fileKey = await generateFileKey();
	const wrapped = await wrapFileKey(a.vaultKey, fileKey);
	await expect(unwrapFileKey(b.vaultKey, wrapped)).rejects.toThrow();
});
