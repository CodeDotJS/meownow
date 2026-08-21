import { randomBytes, toArrayBuffer } from "./bytes";
import { AES_GCM, AES_GCM_IV_LENGTH, FILE_USAGES, VAULT_USAGES } from "./constants";
import { CryptoFailure } from "./errors";

export type WrappedKey = {
	iv: Uint8Array;
	bytes: Uint8Array;
};

export async function wrapRawKey(wrappingKey: CryptoKey, subject: CryptoKey): Promise<WrappedKey> {
	const iv = randomBytes(AES_GCM_IV_LENGTH);
	const bytes = new Uint8Array(
		await crypto.subtle.wrapKey("raw", subject, wrappingKey, {
			name: "AES-GCM",
			iv: toArrayBuffer(iv),
		}),
	);
	return { iv, bytes };
}

export async function unwrapRawKey(
	wrappingKey: CryptoKey,
	wrapped: WrappedKey,
	extractable: boolean,
	usages: KeyUsage[],
): Promise<CryptoKey> {
	try {
		return await crypto.subtle.unwrapKey(
			"raw",
			toArrayBuffer(wrapped.bytes),
			wrappingKey,
			{ name: "AES-GCM", iv: toArrayBuffer(wrapped.iv) },
			AES_GCM,
			extractable,
			usages,
		);
	} catch {
		throw new CryptoFailure("tamper", "wrapped key failed authentication");
	}
}

export async function wrapPkcs8Key(
	wrappingKey: CryptoKey,
	subject: CryptoKey,
): Promise<WrappedKey> {
	const iv = randomBytes(AES_GCM_IV_LENGTH);
	const bytes = new Uint8Array(
		await crypto.subtle.wrapKey("pkcs8", subject, wrappingKey, {
			name: "AES-GCM",
			iv: toArrayBuffer(iv),
		}),
	);
	return { iv, bytes };
}

export async function unwrapPkcs8EcdhKey(
	wrappingKey: CryptoKey,
	wrapped: WrappedKey,
	extractable: boolean,
): Promise<CryptoKey> {
	try {
		return await crypto.subtle.unwrapKey(
			"pkcs8",
			toArrayBuffer(wrapped.bytes),
			wrappingKey,
			{ name: "AES-GCM", iv: toArrayBuffer(wrapped.iv) },
			{ name: "ECDH", namedCurve: "P-256" },
			extractable,
			["deriveBits"],
		);
	} catch {
		throw new CryptoFailure("tamper", "wrapped key failed authentication");
	}
}

export async function importAesGcmKey(
	raw: BufferSource,
	extractable: boolean,
	usages: KeyUsage[] = VAULT_USAGES,
): Promise<CryptoKey> {
	return crypto.subtle.importKey("raw", raw, AES_GCM, extractable, usages);
}

export { FILE_USAGES, VAULT_USAGES };
