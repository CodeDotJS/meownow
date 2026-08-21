export { type AadInput, encodeAad, type ItemKind } from "./aad";
export { decrypt, encrypt, type Sealed } from "./aead";
export {
	CHUNK_SIZE,
	type ChunkedCiphertext,
	chunkIv,
	decryptChunks,
	encryptChunks,
	splitChunks,
} from "./chunks";
export { SCHEMA_VERSION } from "./constants";
export { CryptoFailure } from "./errors";
export {
	type DirectedItemKey,
	generateIdentityKeyPair,
	unwrapIdentityKey,
	unwrapItemKeyForRecipient,
	wrapIdentityKey,
	wrapItemKeyForRecipient,
} from "./identity";
export {
	fingerprintSharedSecret,
	generatePairingKeyPair,
	type PairingWrap,
	publicJwk,
	unwrapVaultFromPairing,
	wrapVaultForPairing,
} from "./pairing";
export { ARGON2_PRODUCTION, ARGON2_TEST, recoverVault, validateMnemonic } from "./recovery";
export {
	createVault,
	generateFileKey,
	generateVaultKey,
	unwrapFileKey,
	type Vault,
	wrapFileKey,
} from "./vault";
export type { WrappedKey } from "./wrap";
