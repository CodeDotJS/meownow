import { expect, test } from "vitest";
import { compressBlobPlaintext, decompressBlobPlaintext } from "./blob-compress";

test("gzip shrinks repetitive plaintext and round-trips", () => {
	const plain = new TextEncoder().encode("meow ".repeat(4_000));
	const packed = compressBlobPlaintext(plain);
	expect(packed.compression).toBe("gzip");
	expect(packed.bytes.byteLength).toBeLessThan(plain.byteLength);
	const restored = decompressBlobPlaintext(packed.bytes, packed.compression);
	expect(restored).toEqual(plain);
});

test("keeps the original when gzip does not shrink", () => {
	const plain = crypto.getRandomValues(new Uint8Array(2_048));
	const packed = compressBlobPlaintext(plain);
	expect(packed.compression).toBe("none");
	expect(packed.bytes).toBe(plain);
	expect(decompressBlobPlaintext(packed.bytes, packed.compression)).toBe(plain);
});

test("tiny payloads stay uncompressed", () => {
	const plain = new TextEncoder().encode("hi");
	const packed = compressBlobPlaintext(plain);
	expect(packed.compression).toBe("none");
	expect(packed.bytes).toBe(plain);
});

test("legacy items without a codec stay as-is", () => {
	const plain = new TextEncoder().encode("already decrypted");
	expect(decompressBlobPlaintext(plain, undefined)).toBe(plain);
	expect(decompressBlobPlaintext(plain, "none")).toBe(plain);
});

test("unknown codec is rejected", () => {
	const plain = new TextEncoder().encode("secret");
	expect(() => decompressBlobPlaintext(plain, "br")).toThrow(/unknown_blob_compression/);
});
