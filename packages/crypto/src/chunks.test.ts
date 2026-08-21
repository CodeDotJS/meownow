import { expect, test } from "vitest";
import { CHUNK_SIZE, chunkIv, decryptChunks, encryptChunks, splitChunks } from "./chunks";
import { generateFileKey } from "./vault";

const aad = { itemId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", kind: "file" as const };

test("1 MiB plus one byte splits into two chunks", () => {
	const data = new Uint8Array(CHUNK_SIZE + 1);
	const parts = splitChunks(data);
	expect(parts).toHaveLength(2);
	expect(parts[0]?.byteLength).toBe(CHUNK_SIZE);
	expect(parts[1]?.byteLength).toBe(1);
});

test("chunk IVs differ by index and never reuse the trailer slot", () => {
	const baseIv = new Uint8Array(8).fill(7);
	const iv0 = chunkIv(baseIv, 0);
	const iv1 = chunkIv(baseIv, 1);
	const trailer = chunkIv(baseIv, 0xffffffff);
	expect(iv0).toHaveLength(12);
	expect(iv0).not.toEqual(iv1);
	expect(iv1).not.toEqual(trailer);
});

test("chunk encrypt then decrypt roundtrips", async () => {
	const key = await generateFileKey();
	const plain = new TextEncoder().encode("file-bytes-here");
	const sealed = await encryptChunks(key, plain, aad);
	const opened = await decryptChunks(key, sealed, aad);
	expect(new TextDecoder().decode(opened)).toBe("file-bytes-here");
});

test("dropping a chunk is detected via the truncation tag", async () => {
	const key = await generateFileKey();
	const data = new Uint8Array(CHUNK_SIZE + 8);
	data.fill(9);
	const sealed = await encryptChunks(key, data, aad);
	expect(sealed.chunks.length).toBe(2);
	sealed.chunks.pop();
	await expect(decryptChunks(key, sealed, aad)).rejects.toThrow(/truncat/i);
});

test("tampering with a chunk is detected", async () => {
	const key = await generateFileKey();
	const sealed = await encryptChunks(key, new TextEncoder().encode("abc"), aad);
	const first = sealed.chunks[0];
	if (!first) {
		throw new Error("missing chunk");
	}
	first[0] = (first[0] ?? 0) ^ 0xff;
	await expect(decryptChunks(key, sealed, aad)).rejects.toThrow(/tamper/i);
});
