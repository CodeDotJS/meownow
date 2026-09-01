import { expect, test } from "vitest";
import { emptyPlaintextError, shouldKeepOriginalImageBytes } from "./upload-bytes";

test("keeps the original file when the canvas rewrite is empty", () => {
	expect(shouldKeepOriginalImageBytes({ width: 12, height: 8 }, new Blob([]))).toBe(true);
	expect(
		shouldKeepOriginalImageBytes({ width: 0, height: 10 }, new Blob([new Uint8Array([1])])),
	).toBe(true);
	expect(shouldKeepOriginalImageBytes(null, new Blob([new Uint8Array([1])]))).toBe(true);
});

test("uses the canvas PNG when it actually has pixels", () => {
	expect(
		shouldKeepOriginalImageBytes({ width: 12, height: 8 }, new Blob([new Uint8Array([1, 2, 3])])),
	).toBe(false);
});

test("empty plaintext cannot be a stored image", () => {
	expect(emptyPlaintextError(new Uint8Array(0))).toBe("item_invalid");
	expect(emptyPlaintextError(new Uint8Array([1]))).toBeNull();
});
