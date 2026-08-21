import { randomBytes } from "./bytes";
import { AES_GCM, FILE_USAGES, VAULT_USAGES } from "./constants";
import type { Argon2Params } from "./recovery";
import { ARGON2_PRODUCTION, deriveRecoveryKey, generateMnemonic } from "./recovery";
import { unwrapRawKey, type WrappedKey, wrapRawKey } from "./wrap";

export type Vault = {
	vaultKey: CryptoKey;
	/** Extractable clone for pairing wrap. M3 must drop this after writing a device-wrapped copy. */
	extractableVaultKey: CryptoKey;
	mnemonic: string;
	recoverySalt: Uint8Array;
	wrappedVaultRecovery: WrappedKey;
};

export async function generateVaultKey(): Promise<CryptoKey> {
	return crypto.subtle.generateKey(AES_GCM, false, VAULT_USAGES);
}

export async function generateFileKey(): Promise<CryptoKey> {
	return crypto.subtle.generateKey(AES_GCM, true, FILE_USAGES);
}

export async function wrapFileKey(vaultKey: CryptoKey, fileKey: CryptoKey): Promise<WrappedKey> {
	return wrapRawKey(vaultKey, fileKey);
}

export async function unwrapFileKey(vaultKey: CryptoKey, wrapped: WrappedKey): Promise<CryptoKey> {
	return unwrapRawKey(vaultKey, wrapped, false, FILE_USAGES);
}

export async function createVault(options?: { argon2?: Argon2Params }): Promise<Vault> {
	const extractableVaultKey = await crypto.subtle.generateKey(AES_GCM, true, VAULT_USAGES);
	const mnemonic = await generateMnemonic();
	const recoverySalt = randomBytes(16);
	const wrappingKey = await deriveRecoveryKey(
		mnemonic,
		recoverySalt,
		options?.argon2 ?? ARGON2_PRODUCTION,
	);
	const wrappedVaultRecovery = await wrapRawKey(wrappingKey, extractableVaultKey);
	const raw = await crypto.subtle.exportKey("raw", extractableVaultKey);
	const vaultKey = await crypto.subtle.importKey("raw", raw, AES_GCM, false, VAULT_USAGES);
	return {
		vaultKey,
		extractableVaultKey,
		mnemonic,
		recoverySalt,
		wrappedVaultRecovery,
	};
}

export async function wrapExtractableForDevice(
	deviceKey: CryptoKey,
	extractableVaultKey: CryptoKey,
): Promise<WrappedKey> {
	return wrapRawKey(deviceKey, extractableVaultKey);
}

export async function unwrapExtractableForPairing(
	deviceKey: CryptoKey,
	wrapped: WrappedKey,
): Promise<CryptoKey> {
	return unwrapRawKey(deviceKey, wrapped, true, VAULT_USAGES);
}
