import { HKDF_INFO_ITEM } from "./constants";
import { ecdhBits, generateEcdhKeyPair, hkdfAesGcmKey, importEcdhPublic, publicJwk } from "./ecdh";
import {
	FILE_USAGES,
	unwrapPkcs8EcdhKey,
	unwrapRawKey,
	type WrappedKey,
	wrapPkcs8Key,
	wrapRawKey,
} from "./wrap";

export async function generateIdentityKeyPair(): Promise<CryptoKeyPair> {
	return generateEcdhKeyPair();
}

export async function wrapIdentityKey(
	vaultKey: CryptoKey,
	privateKey: CryptoKey,
): Promise<WrappedKey> {
	return wrapPkcs8Key(vaultKey, privateKey);
}

export async function unwrapIdentityKey(
	vaultKey: CryptoKey,
	wrapped: WrappedKey,
): Promise<CryptoKey> {
	return unwrapPkcs8EcdhKey(vaultKey, wrapped, false);
}

export type DirectedItemKey = WrappedKey & {
	ephPublicJwk: JsonWebKey;
};

export async function wrapItemKeyForRecipient(
	itemKey: CryptoKey,
	recipientPublicKey: CryptoKey,
): Promise<DirectedItemKey> {
	const eph = await generateEcdhKeyPair();
	const ikm = await ecdhBits(eph.privateKey, recipientPublicKey);
	const wrappingKey = await hkdfAesGcmKey(ikm, HKDF_INFO_ITEM);
	const wrapped = await wrapRawKey(wrappingKey, itemKey);
	return {
		...wrapped,
		ephPublicJwk: await publicJwk(eph.publicKey),
	};
}

export async function unwrapItemKeyForRecipient(
	payload: DirectedItemKey,
	recipientPrivateKey: CryptoKey,
): Promise<CryptoKey> {
	const ephPub = await importEcdhPublic(payload.ephPublicJwk);
	const ikm = await ecdhBits(recipientPrivateKey, ephPub);
	const wrappingKey = await hkdfAesGcmKey(ikm, HKDF_INFO_ITEM);
	return unwrapRawKey(wrappingKey, payload, false, FILE_USAGES);
}
