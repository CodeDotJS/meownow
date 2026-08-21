export const SCHEMA_VERSION = 1;
export const CHUNK_SIZE = 1_048_576;
export const AES_GCM_IV_LENGTH = 12;
export const BASE_IV_LENGTH = 8;
export const TRAILER_CHUNK_INDEX = 0xff_ff_ff_ff;
export const FINGERPRINT_MOD = 1_000_000;

export const HKDF_SALT = new TextEncoder().encode("meownow-hkdf-v1");
export const HKDF_INFO_PAIRING = new TextEncoder().encode("meownow-pairing-wrap-v1");
export const HKDF_INFO_FINGERPRINT = new TextEncoder().encode("meownow-fingerprint-v1");
export const HKDF_INFO_ITEM = new TextEncoder().encode("meownow-item-wrap-v1");

export const AES_GCM: AesKeyGenParams = { name: "AES-GCM", length: 256 };
export const ECDH_P256: EcKeyGenParams = { name: "ECDH", namedCurve: "P-256" };

export const VAULT_USAGES: KeyUsage[] = ["encrypt", "decrypt", "wrapKey", "unwrapKey"];
export const FILE_USAGES: KeyUsage[] = ["encrypt", "decrypt"];
export const ECDH_USAGES: KeyUsage[] = ["deriveBits"];
