import { expect, test } from "vitest";
import { editIntent, persistIntent } from "./persist-intent";

test("live only never enters the outbox", () => {
	expect(persistIntent({ ephemeral: true, syncEnabled: true, online: true })).toBe("live");
	expect(persistIntent({ ephemeral: true, syncEnabled: false, online: false })).toBe("live");
});

test("sync off holds even when online", () => {
	expect(persistIntent({ ephemeral: false, syncEnabled: false, online: true })).toBe("hold");
});

test("sync on queues when offline and posts when online", () => {
	expect(persistIntent({ ephemeral: false, syncEnabled: true, online: false })).toBe("queue");
	expect(persistIntent({ ephemeral: false, syncEnabled: true, online: true })).toBe("post");
});

test("edit of a live-only note stays off the store", () => {
	expect(editIntent({ ephemeral: true, posted: true, syncEnabled: true, online: true })).toBe(
		"live",
	);
});

test("edit of a note that never posted just rewrites the outbox row", () => {
	expect(editIntent({ ephemeral: false, posted: false, syncEnabled: true, online: true })).toBe(
		"rewrite",
	);
	expect(editIntent({ ephemeral: false, posted: false, syncEnabled: false, online: false })).toBe(
		"rewrite",
	);
});

test("edit of a stored note patches when sync is on and online, else waits as dirty", () => {
	expect(editIntent({ ephemeral: false, posted: true, syncEnabled: true, online: true })).toBe(
		"patch",
	);
	expect(editIntent({ ephemeral: false, posted: true, syncEnabled: true, online: false })).toBe(
		"dirty",
	);
	expect(editIntent({ ephemeral: false, posted: true, syncEnabled: false, online: true })).toBe(
		"dirty",
	);
});
