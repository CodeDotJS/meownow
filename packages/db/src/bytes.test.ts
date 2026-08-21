import { expect, test } from "vitest";
import { fromBase64Url, randomToken, sha256, toBase64Url, uuidToBytes } from "./bytes";

test("invite tokens are 32 bytes and only the hash is stable", () => {
	const token = randomToken();
	expect(token).toHaveLength(32);
	expect(toBase64Url(token)).not.toBe(toBase64Url(sha256(token)));
	expect(sha256(token).equals(sha256(token))).toBe(true);
	expect(fromBase64Url(toBase64Url(token)).equals(token)).toBe(true);
});

test("uuidToBytes is 16 bytes", () => {
	const id = "11111111-1111-1111-1111-111111111111";
	expect(uuidToBytes(id)).toHaveLength(16);
});
