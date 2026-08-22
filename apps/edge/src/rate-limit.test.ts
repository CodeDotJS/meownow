import { expect, test } from "vitest";
import { AUTH_LIMIT, limitStorageKey, takeToken } from "./rate-limit";

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

test("auth limiter keys are isolated so one IP cannot spend another IP's tokens", () => {
	const left = limitStorageKey("auth", "aa".repeat(32));
	const right = limitStorageKey("auth", "bb".repeat(32));
	expect(left).not.toBe(right);
	expect(limitStorageKey("auth", "not-hex")).toBe("bucket:auth:invalid");
	const now = 2_000_000;
	let spent = takeToken(undefined, now, AUTH_LIMIT);
	for (let i = 1; i < AUTH_LIMIT.capacity; i += 1) {
		spent = takeToken(spent.bucket, now, AUTH_LIMIT);
	}
	expect(takeToken(spent.bucket, now, AUTH_LIMIT).ok).toBe(false);
	expect(takeToken(undefined, now, AUTH_LIMIT).ok).toBe(true);
});
