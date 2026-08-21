import { expect, test } from "vitest";
import { decrypt, encrypt } from "./aead";
import { ARGON2_TEST, recoverVault, recoveryVerifier, validateMnemonic } from "./recovery";
import { createVault } from "./vault";

const aad = { itemId: "cccccccc-cccc-cccc-cccc-cccccccccccc", kind: "link" as const };

test("validateMnemonic accepts a generated phrase and rejects a broken checksum", async () => {
	const vault = await createVault({ argon2: ARGON2_TEST });
	expect(await validateMnemonic(vault.mnemonic)).toBe(true);
	const words = vault.mnemonic.split(" ");
	const last = words[11];
	if (!last) {
		throw new Error("mnemonic short");
	}
	words[11] = last === "zoo" ? "abandon" : "zoo";
	expect(await validateMnemonic(words.join(" "))).toBe(false);
});

test("recovery phrase restores a vault that can decrypt prior ciphertext", async () => {
	const vault = await createVault({ argon2: ARGON2_TEST });
	const sealed = await encrypt(vault.vaultKey, new TextEncoder().encode("keep"), aad);
	const restored = await recoverVault({
		mnemonic: vault.mnemonic,
		salt: vault.recoverySalt,
		wrapped: vault.wrappedVaultRecovery,
		argon2: ARGON2_TEST,
	});
	expect(restored.extractable).toBe(false);
	expect(new TextDecoder().decode(await decrypt(restored, sealed, aad))).toBe("keep");
});

test("wrong recovery phrase cannot unwrap the vault", async () => {
	const vault = await createVault({ argon2: ARGON2_TEST });
	const other = await createVault({ argon2: ARGON2_TEST });
	await expect(
		recoverVault({
			mnemonic: other.mnemonic,
			salt: vault.recoverySalt,
			wrapped: vault.wrappedVaultRecovery,
			argon2: ARGON2_TEST,
		}),
	).rejects.toThrow();
});

test("recovery verifier matches only the originating phrase", async () => {
	const vault = await createVault({ argon2: ARGON2_TEST });
	const other = await createVault({ argon2: ARGON2_TEST });
	const verifier = await recoveryVerifier(vault.mnemonic, vault.recoverySalt, ARGON2_TEST);
	const again = await recoveryVerifier(vault.mnemonic, vault.recoverySalt, ARGON2_TEST);
	expect(verifier).toEqual(again);
	expect(verifier).not.toEqual(
		await recoveryVerifier(other.mnemonic, vault.recoverySalt, ARGON2_TEST),
	);
});
