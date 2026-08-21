import { expect, test } from "vitest";
import { decrypt, encrypt } from "./aead";
import {
	generateIdentityKeyPair,
	unwrapIdentityKey,
	unwrapItemKeyForRecipient,
	wrapIdentityKey,
	wrapItemKeyForRecipient,
} from "./identity";
import { ARGON2_TEST } from "./recovery";
import { createVault, generateFileKey } from "./vault";

const aad = { itemId: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", kind: "text" as const };

test("identity private key wraps under VaultKey", async () => {
	const vault = await createVault({ argon2: ARGON2_TEST });
	const identity = await generateIdentityKeyPair();
	const wrapped = await wrapIdentityKey(vault.vaultKey, identity.privateKey);
	const restored = await unwrapIdentityKey(vault.vaultKey, wrapped);
	const itemKey = await generateFileKey();
	const forRecipient = await wrapItemKeyForRecipient(itemKey, identity.publicKey);
	const opened = await unwrapItemKeyForRecipient(forRecipient, restored);
	const sealed = await encrypt(itemKey, new TextEncoder().encode("hi"), aad);
	expect(new TextDecoder().decode(await decrypt(opened, sealed, aad))).toBe("hi");
});

test("a stranger identity cannot unwrap a directed ItemKey", async () => {
	const vault = await createVault({ argon2: ARGON2_TEST });
	const alice = await generateIdentityKeyPair();
	const bob = await generateIdentityKeyPair();
	const itemKey = await generateFileKey();
	const wrapped = await wrapItemKeyForRecipient(itemKey, alice.publicKey);
	const bobPriv = await unwrapIdentityKey(
		vault.vaultKey,
		await wrapIdentityKey(vault.vaultKey, bob.privateKey),
	);
	await expect(unwrapItemKeyForRecipient(wrapped, bobPriv)).rejects.toThrow();
});
