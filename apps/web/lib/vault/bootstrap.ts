import {
	createVault,
	generateIdentityKeyPair,
	generateVaultKey,
	publicJwk,
	recoveryVerifier,
	wrapExtractableForDevice,
	wrapIdentityKey,
} from "@meownow/crypto";
import { asPublicJwk } from "@meownow/protocol";
import { errorCode, postJson } from "../client/http";
import { saveVault } from "./idb";
import { bytesToB64url, wrapToWire } from "./wire";

export async function bootstrapVault(userId: string): Promise<string> {
	const vault = await createVault();
	const identity = await generateIdentityKeyPair();
	const deviceKey = await generateVaultKey();
	const wrappedExtractable = await wrapExtractableForDevice(deviceKey, vault.extractableVaultKey);
	const wrappedIdentity = await wrapIdentityKey(vault.vaultKey, identity.privateKey);
	const identityPub = asPublicJwk(await publicJwk(identity.publicKey));
	const verifier = await recoveryVerifier(vault.mnemonic, vault.recoverySalt);
	const res = await postJson("/api/vault", {
		identityPub,
		wrappedVaultRecovery: wrapToWire(vault.wrappedVaultRecovery),
		recoverySalt: bytesToB64url(vault.recoverySalt),
		recoveryVerifier: bytesToB64url(verifier),
	});
	if (!res.ok) {
		throw new Error(errorCode(res.data));
	}
	await saveVault({
		userId,
		vaultKey: vault.vaultKey,
		deviceKey,
		wrappedExtractable,
		wrappedIdentity,
		identityPub,
	});
	return vault.mnemonic;
}
