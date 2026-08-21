import { expect, test } from "vitest";
import { decrypt, encrypt } from "./aead";
import {
	fingerprintSharedSecret,
	generatePairingKeyPair,
	publicJwk,
	unwrapVaultFromPairing,
	wrapVaultForPairing,
} from "./pairing";
import { ARGON2_TEST } from "./recovery";
import { createVault } from "./vault";

const aad = { itemId: "dddddddd-dddd-dddd-dddd-dddddddddddd", kind: "text" as const };

test("pairing wrap on device A unwraps on device B with matching fingerprints", async () => {
	const vault = await createVault({ argon2: ARGON2_TEST });
	const sealed = await encrypt(vault.vaultKey, new TextEncoder().encode("paired"), aad);
	const newDevice = await generatePairingKeyPair();
	const newPub = await publicJwk(newDevice.publicKey);
	const payload = await wrapVaultForPairing(vault.extractableVaultKey, newPub);
	const newFp = await fingerprintSharedSecret(newDevice.privateKey, payload.ephPublicJwk);
	expect(payload.fingerprint).toMatch(/^\d{6}$/);
	expect(newFp).toBe(payload.fingerprint);
	const imported = await unwrapVaultFromPairing(newDevice.privateKey, payload);
	expect(imported.extractable).toBe(false);
	expect(new TextDecoder().decode(await decrypt(imported, sealed, aad))).toBe("paired");
});

test("a MITM public key produces a different fingerprint", async () => {
	const vault = await createVault({ argon2: ARGON2_TEST });
	const newDevice = await generatePairingKeyPair();
	const attacker = await generatePairingKeyPair();
	const payload = await wrapVaultForPairing(
		vault.extractableVaultKey,
		await publicJwk(newDevice.publicKey),
	);
	const attackerFp = await fingerprintSharedSecret(attacker.privateKey, payload.ephPublicJwk);
	expect(attackerFp).not.toBe(payload.fingerprint);
});
