import { argon2id } from "hash-wasm";
import { toArrayBuffer } from "./bytes";
import { CryptoFailure } from "./errors";
import { generateMnemonic, validateMnemonic } from "./mnemonic";
import { importAesGcmKey, unwrapRawKey, type WrappedKey } from "./wrap";

export type Argon2Params = {
	parallelism: number;
	iterations: number;
	memorySize: number;
	hashLength: number;
};

/** OWASP-recommended-ish interactive parameters. */
export const ARGON2_PRODUCTION: Argon2Params = {
	parallelism: 1,
	iterations: 3,
	memorySize: 19_456,
	hashLength: 32,
};

/** Tiny params so unit tests stay fast. Never use at rest. */
export const ARGON2_TEST: Argon2Params = {
	parallelism: 1,
	iterations: 1,
	memorySize: 32,
	hashLength: 32,
};

export { generateMnemonic, validateMnemonic };

export async function deriveRecoveryKey(
	mnemonic: string,
	salt: Uint8Array,
	params: Argon2Params = ARGON2_PRODUCTION,
): Promise<CryptoKey> {
	if (!(await validateMnemonic(mnemonic))) {
		throw new CryptoFailure("mnemonic", "recovery phrase checksum failed");
	}
	const raw = await argon2id({
		password: mnemonic,
		salt,
		parallelism: params.parallelism,
		iterations: params.iterations,
		memorySize: params.memorySize,
		hashLength: params.hashLength,
		outputType: "binary",
	});
	return importAesGcmKey(toArrayBuffer(raw), false);
}

export async function recoverVault(input: {
	mnemonic: string;
	salt: Uint8Array;
	wrapped: WrappedKey;
	argon2?: Argon2Params;
}): Promise<CryptoKey> {
	const wrappingKey = await deriveRecoveryKey(input.mnemonic, input.salt, input.argon2);
	return unwrapRawKey(wrappingKey, input.wrapped, false, [
		"encrypt",
		"decrypt",
		"wrapKey",
		"unwrapKey",
	]);
}
