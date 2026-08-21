import { argon2id } from "hash-wasm";
import { concatBytes, toArrayBuffer } from "./bytes";
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
	const raw = await argon2Raw(mnemonic, salt, params);
	return importAesGcmKey(toArrayBuffer(raw), false);
}

export async function recoveryVerifier(
	mnemonic: string,
	salt: Uint8Array,
	params: Argon2Params = ARGON2_PRODUCTION,
): Promise<Uint8Array> {
	const raw = await argon2Raw(mnemonic, salt, params);
	const info = new TextEncoder().encode("meownow-recover-v1");
	return new Uint8Array(
		await crypto.subtle.digest("SHA-256", toArrayBuffer(concatBytes(info, raw))),
	);
}

async function argon2Raw(
	mnemonic: string,
	salt: Uint8Array,
	params: Argon2Params,
): Promise<Uint8Array> {
	if (!(await validateMnemonic(mnemonic))) {
		throw new CryptoFailure("mnemonic", "recovery phrase checksum failed");
	}
	return argon2id({
		password: mnemonic,
		salt,
		parallelism: params.parallelism,
		iterations: params.iterations,
		memorySize: params.memorySize,
		hashLength: params.hashLength,
		outputType: "binary",
	});
}

export async function recoverVault(input: {
	mnemonic: string;
	salt: Uint8Array;
	wrapped: WrappedKey;
	argon2?: Argon2Params;
}): Promise<CryptoKey> {
	return recover(input, false);
}

export async function recoverExtractableVault(input: {
	mnemonic: string;
	salt: Uint8Array;
	wrapped: WrappedKey;
	argon2?: Argon2Params;
}): Promise<CryptoKey> {
	return recover(input, true);
}

async function recover(
	input: {
		mnemonic: string;
		salt: Uint8Array;
		wrapped: WrappedKey;
		argon2?: Argon2Params;
	},
	extractable: boolean,
): Promise<CryptoKey> {
	const wrappingKey = await deriveRecoveryKey(input.mnemonic, input.salt, input.argon2);
	return unwrapRawKey(wrappingKey, input.wrapped, extractable, [
		"encrypt",
		"decrypt",
		"wrapKey",
		"unwrapKey",
	]);
}
