import { toArrayBuffer } from "./bytes";
import { AES_GCM, ECDH_P256, HKDF_SALT } from "./constants";

export async function generateEcdhKeyPair(): Promise<CryptoKeyPair> {
	return crypto.subtle.generateKey(ECDH_P256, true, ["deriveBits"]);
}

export async function publicJwk(key: CryptoKey): Promise<JsonWebKey> {
	return crypto.subtle.exportKey("jwk", key);
}

export async function importEcdhPublic(jwk: JsonWebKey): Promise<CryptoKey> {
	return crypto.subtle.importKey("jwk", jwk, ECDH_P256, true, []);
}

export async function ecdhBits(privateKey: CryptoKey, publicKey: CryptoKey): Promise<Uint8Array> {
	return new Uint8Array(
		await crypto.subtle.deriveBits({ name: "ECDH", public: publicKey }, privateKey, 256),
	);
}

export async function hkdfAesGcmKey(ikm: Uint8Array, info: Uint8Array): Promise<CryptoKey> {
	const base = await crypto.subtle.importKey("raw", toArrayBuffer(ikm), "HKDF", false, [
		"deriveKey",
	]);
	return crypto.subtle.deriveKey(
		{ name: "HKDF", hash: "SHA-256", salt: toArrayBuffer(HKDF_SALT), info: toArrayBuffer(info) },
		base,
		AES_GCM,
		false,
		["wrapKey", "unwrapKey"],
	);
}

export async function hkdfBits(
	ikm: Uint8Array,
	info: Uint8Array,
	byteLength: number,
): Promise<Uint8Array> {
	const base = await crypto.subtle.importKey("raw", toArrayBuffer(ikm), "HKDF", false, [
		"deriveBits",
	]);
	return new Uint8Array(
		await crypto.subtle.deriveBits(
			{ name: "HKDF", hash: "SHA-256", salt: toArrayBuffer(HKDF_SALT), info: toArrayBuffer(info) },
			base,
			byteLength * 8,
		),
	);
}
