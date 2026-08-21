import { expect, test } from "vitest";
import { decrypt, encodeAad, encrypt } from "./aead";
import { generateVaultKey } from "./vault";

const aad = { itemId: "11111111-1111-1111-1111-111111111111", kind: "text" as const };

test("encrypt then decrypt returns plaintext", async () => {
	const key = await generateVaultKey();
	const plain = new TextEncoder().encode("hello clipboard");
	const sealed = await encrypt(key, plain, aad);
	const opened = await decrypt(key, sealed, aad);
	expect(new TextDecoder().decode(opened)).toBe("hello clipboard");
});

test("tampering with ciphertext is detected", async () => {
	const key = await generateVaultKey();
	const sealed = await encrypt(key, new TextEncoder().encode("secret"), aad);
	sealed.bytes[0] = (sealed.bytes[0] ?? 0) ^ 0xff;
	await expect(decrypt(key, sealed, aad)).rejects.toThrow(/tamper/i);
});

test("ciphertext cannot be replayed under a different item id", async () => {
	const key = await generateVaultKey();
	const sealed = await encrypt(key, new TextEncoder().encode("secret"), aad);
	await expect(
		decrypt(key, sealed, { itemId: "22222222-2222-2222-2222-222222222222", kind: "text" }),
	).rejects.toThrow(/tamper|aad/i);
});

test("encodeAad binds id, kind, and schema version", () => {
	const a = encodeAad({ itemId: "a", kind: "text", schemaVersion: 1 });
	const b = encodeAad({ itemId: "a", kind: "link", schemaVersion: 1 });
	const c = encodeAad({ itemId: "a", kind: "text", schemaVersion: 2 });
	expect(a).not.toEqual(b);
	expect(a).not.toEqual(c);
});
