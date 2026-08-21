import type { AadInput } from "./aad";
import { encodeAad } from "./aad";

export { encodeAad };

import { randomBytes, toArrayBuffer } from "./bytes";
import { AES_GCM_IV_LENGTH } from "./constants";
import { CryptoFailure } from "./errors";

export type Sealed = {
	iv: Uint8Array;
	bytes: Uint8Array;
};

export async function encrypt(
	key: CryptoKey,
	plaintext: Uint8Array,
	aad: AadInput,
): Promise<Sealed> {
	const iv = randomBytes(AES_GCM_IV_LENGTH);
	const bytes = new Uint8Array(
		await crypto.subtle.encrypt(
			{ name: "AES-GCM", iv: toArrayBuffer(iv), additionalData: toArrayBuffer(encodeAad(aad)) },
			key,
			toArrayBuffer(plaintext),
		),
	);
	return { iv, bytes };
}

export async function decrypt(key: CryptoKey, sealed: Sealed, aad: AadInput): Promise<Uint8Array> {
	try {
		return new Uint8Array(
			await crypto.subtle.decrypt(
				{
					name: "AES-GCM",
					iv: toArrayBuffer(sealed.iv),
					additionalData: toArrayBuffer(encodeAad(aad)),
				},
				key,
				toArrayBuffer(sealed.bytes),
			),
		);
	} catch {
		throw new CryptoFailure("tamper", "tamper: ciphertext failed authentication");
	}
}

export async function encryptWithIv(
	key: CryptoKey,
	plaintext: Uint8Array,
	iv: Uint8Array,
	aad: AadInput,
): Promise<Uint8Array> {
	return new Uint8Array(
		await crypto.subtle.encrypt(
			{ name: "AES-GCM", iv: toArrayBuffer(iv), additionalData: toArrayBuffer(encodeAad(aad)) },
			key,
			toArrayBuffer(plaintext),
		),
	);
}

export async function decryptWithIv(
	key: CryptoKey,
	ciphertext: Uint8Array,
	iv: Uint8Array,
	aad: AadInput,
): Promise<Uint8Array> {
	try {
		return new Uint8Array(
			await crypto.subtle.decrypt(
				{ name: "AES-GCM", iv: toArrayBuffer(iv), additionalData: toArrayBuffer(encodeAad(aad)) },
				key,
				toArrayBuffer(ciphertext),
			),
		);
	} catch {
		throw new CryptoFailure("tamper", "tamper: ciphertext failed authentication");
	}
}
