import { expect, test } from "vitest";
import type { LastMe } from "@/lib/vault/item-cache";
import { resolveSession } from "./session-cache";

const cached: LastMe = {
	id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
	handle: "rishi",
	displayName: "Rishi",
	role: "admin",
	canUpload: true,
	hasVault: true,
};

test("a live profile wins and is stored", () => {
	const profile = { ...cached, handle: "ada" };
	expect(
		resolveSession({ status: 200, profile, cachedMe: cached, hasLocal: true }),
	).toEqual(profile);
});

test("offline with keys and a snapshot keeps the tray signed in", () => {
	expect(
		resolveSession({ status: 0, profile: null, cachedMe: cached, hasLocal: true }),
	).toEqual(cached);
});

test("offline without keys is signed out", () => {
	expect(
		resolveSession({ status: 0, profile: null, cachedMe: cached, hasLocal: false }),
	).toBeNull();
});

test("a live unauthorized response does not use lastMe", () => {
	expect(
		resolveSession({ status: 401, profile: null, cachedMe: cached, hasLocal: true }),
	).toBeNull();
});
