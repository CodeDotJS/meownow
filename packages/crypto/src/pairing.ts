import { readU32be } from "./bytes";
import { FINGERPRINT_MOD, HKDF_INFO_FINGERPRINT, HKDF_INFO_PAIRING } from "./constants";
import {
	ecdhBits,
	generateEcdhKeyPair,
	hkdfAesGcmKey,
	hkdfBits,
	importEcdhPublic,
	publicJwk,
} from "./ecdh";
import { unwrapRawKey, type WrappedKey, wrapRawKey } from "./wrap";

export { generateEcdhKeyPair as generatePairingKeyPair, publicJwk };

export type PairingWrap = WrappedKey & {
	ephPublicJwk: JsonWebKey;
	fingerprint: string;
};

export async function fingerprintFromShared(ikm: Uint8Array): Promise<string> {
	const digest = await hkdfBits(ikm, HKDF_INFO_FINGERPRINT, 4);
	const n = readU32be(digest) % FINGERPRINT_MOD;
	return n.toString().padStart(6, "0");
}

export async function fingerprintSharedSecret(
	privateKey: CryptoKey,
	remotePublicJwk: JsonWebKey,
): Promise<string> {
	const remote = await importEcdhPublic(remotePublicJwk);
	const ikm = await ecdhBits(privateKey, remote);
	return fingerprintFromShared(ikm);
}

export async function wrapVaultForPairing(
	extractableVaultKey: CryptoKey,
	remotePublicJwk: JsonWebKey,
): Promise<PairingWrap> {
	const eph = await generateEcdhKeyPair();
	const remote = await importEcdhPublic(remotePublicJwk);
	const ikm = await ecdhBits(eph.privateKey, remote);
	const wrappingKey = await hkdfAesGcmKey(ikm, HKDF_INFO_PAIRING);
	const wrapped = await wrapRawKey(wrappingKey, extractableVaultKey);
	return {
		...wrapped,
		ephPublicJwk: await publicJwk(eph.publicKey),
		fingerprint: await fingerprintFromShared(ikm),
	};
}

export async function unwrapVaultFromPairing(
	newDevicePrivateKey: CryptoKey,
	payload: PairingWrap,
): Promise<CryptoKey> {
	const ephPub = await importEcdhPublic(payload.ephPublicJwk);
	const ikm = await ecdhBits(newDevicePrivateKey, ephPub);
	const wrappingKey = await hkdfAesGcmKey(ikm, HKDF_INFO_PAIRING);
	return unwrapRawKey(wrappingKey, payload, false, ["encrypt", "decrypt", "wrapKey", "unwrapKey"]);
}
