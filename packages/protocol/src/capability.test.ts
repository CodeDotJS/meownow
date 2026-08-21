import { expect, test } from "vitest";
import { generateCapabilityKeyPair, mintCapabilityToken, openCapabilityToken } from "./capability";

const claims = {
	v: 1 as const,
	purpose: "upload" as const,
	userId: "11111111-1111-4111-8111-111111111111",
	key: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
	maxBytes: 1024,
	blobId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
	exp: Math.floor(Date.now() / 1000) + 60,
};

test("capability token roundtrips and rejects a wrong key or expiry", async () => {
	const keys = await generateCapabilityKeyPair();
	const other = await generateCapabilityKeyPair();
	const jwt = await mintCapabilityToken(keys.privateJwk, claims);
	const opened = await openCapabilityToken(keys.publicJwk, jwt);
	expect(opened?.key).toBe(claims.key);
	expect(opened?.purpose).toBe("upload");
	expect(await openCapabilityToken(other.publicJwk, jwt)).toBeNull();
	expect(
		await openCapabilityToken(
			keys.publicJwk,
			await mintCapabilityToken(keys.privateJwk, {
				...claims,
				exp: Math.floor(Date.now() / 1000) - 1,
			}),
		),
	).toBeNull();
	expect(await openCapabilityToken(keys.publicJwk, "not-a-jwt")).toBeNull();
});
