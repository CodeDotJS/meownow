import type { AadInput } from "./aad";
import { decryptWithIv, encryptWithIv } from "./aead";
import { concatBytes, readU32be, u32be } from "./bytes";
import { CHUNK_SIZE, TRAILER_CHUNK_INDEX } from "./constants";
import { CryptoFailure } from "./errors";

export { CHUNK_SIZE };

export type ChunkedCiphertext = {
	baseIv: Uint8Array;
	chunks: Uint8Array[];
	trailer: Uint8Array;
};

export function chunkIv(baseIv: Uint8Array, index: number): Uint8Array {
	if (baseIv.byteLength !== 8) {
		throw new RangeError("base IV must be 8 bytes");
	}
	return concatBytes(baseIv, u32be(index));
}

export function splitChunks(data: Uint8Array): Uint8Array[] {
	if (data.byteLength === 0) {
		return [];
	}
	const parts: Uint8Array[] = [];
	for (let offset = 0; offset < data.byteLength; offset += CHUNK_SIZE) {
		parts.push(data.subarray(offset, offset + CHUNK_SIZE));
	}
	return parts;
}

export async function encryptChunks(
	fileKey: CryptoKey,
	plaintext: Uint8Array,
	aad: AadInput,
): Promise<ChunkedCiphertext> {
	const parts = splitChunks(plaintext);
	const baseIv = crypto.getRandomValues(new Uint8Array(8));
	const chunks: Uint8Array[] = [];
	for (let i = 0; i < parts.length; i++) {
		const part = parts[i];
		if (!part) {
			continue;
		}
		chunks.push(await encryptWithIv(fileKey, part, chunkIv(baseIv, i), aad));
	}
	const trailer = await encryptWithIv(
		fileKey,
		u32be(chunks.length),
		chunkIv(baseIv, TRAILER_CHUNK_INDEX),
		aad,
	);
	return { baseIv, chunks, trailer };
}

export async function decryptChunks(
	fileKey: CryptoKey,
	sealed: ChunkedCiphertext,
	aad: AadInput,
): Promise<Uint8Array> {
	const countBytes = await decryptWithIv(
		fileKey,
		sealed.trailer,
		chunkIv(sealed.baseIv, TRAILER_CHUNK_INDEX),
		aad,
	);
	if (countBytes.byteLength !== 4) {
		throw new CryptoFailure("truncate", "chunk count tag was truncated");
	}
	const count = readU32be(countBytes);
	if (sealed.chunks.length !== count) {
		throw new CryptoFailure("truncate", "truncated: chunk list does not match chunk_count tag");
	}
	const parts: Uint8Array[] = [];
	for (let i = 0; i < sealed.chunks.length; i++) {
		const chunk = sealed.chunks[i];
		if (!chunk) {
			throw new CryptoFailure("truncate", "missing chunk");
		}
		parts.push(await decryptWithIv(fileKey, chunk, chunkIv(sealed.baseIv, i), aad));
	}
	return concatBytes(...parts);
}
