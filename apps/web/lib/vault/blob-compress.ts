import { gunzipSync, gzipSync } from "fflate";

export type BlobCompression = "gzip" | "none";

const MIN_COMPRESS_BYTES = 64;

export function compressBlobPlaintext(bytes: Uint8Array): {
	bytes: Uint8Array;
	compression: BlobCompression;
} {
	if (bytes.byteLength < MIN_COMPRESS_BYTES) {
		return { bytes, compression: "none" };
	}
	const compressed = gzipSync(bytes, { level: 6 });
	if (compressed.byteLength >= bytes.byteLength) {
		return { bytes, compression: "none" };
	}
	return { bytes: compressed, compression: "gzip" };
}

export function decompressBlobPlaintext(
	bytes: Uint8Array,
	compression: string | undefined,
): Uint8Array {
	if (compression === undefined || compression === "none") {
		return bytes;
	}
	if (compression === "gzip") {
		return gunzipSync(bytes);
	}
	throw new Error("unknown_blob_compression");
}
