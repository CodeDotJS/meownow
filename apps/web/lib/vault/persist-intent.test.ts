import { expect, test } from "vitest";
import { persistIntent } from "./persist-intent";

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
