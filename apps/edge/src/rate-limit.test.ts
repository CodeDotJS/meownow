import { expect, test } from "vitest";
import { AUTH_LIMIT, takeToken } from "./rate-limit";

test("token bucket denies the (capacity+1)th take in the same window", () => {
	const now = 1_000_000;
	let bucket = takeToken(undefined, now, AUTH_LIMIT);
	expect(bucket.ok).toBe(true);
	for (let i = 1; i < AUTH_LIMIT.capacity; i += 1) {
		bucket = takeToken(bucket.bucket, now, AUTH_LIMIT);
		expect(bucket.ok).toBe(true);
	}
	const denied = takeToken(bucket.bucket, now, AUTH_LIMIT);
	expect(denied.ok).toBe(false);
	const later = takeToken(denied.bucket, now + AUTH_LIMIT.windowMs, AUTH_LIMIT);
	expect(later.ok).toBe(true);
});
