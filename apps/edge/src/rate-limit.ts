export type TokenBucket = {
	tokens: number;
	updatedAt: number;
};

export const SEND_LIMIT = { capacity: 30, windowMs: 60_000 };
export const AUTH_LIMIT = { capacity: 10, windowMs: 60_000 };

export function takeToken(
	bucket: TokenBucket | undefined,
	now: number,
	limit: { capacity: number; windowMs: number },
): { ok: boolean; bucket: TokenBucket } {
	const refillPerMs = limit.capacity / limit.windowMs;
	const previous = bucket ?? { tokens: limit.capacity, updatedAt: now };
	const elapsed = Math.max(0, now - previous.updatedAt);
	const filled = Math.min(limit.capacity, previous.tokens + elapsed * refillPerMs);
	if (filled < 1) {
		return { ok: false, bucket: { tokens: filled, updatedAt: now } };
	}
	return { ok: true, bucket: { tokens: filled - 1, updatedAt: now } };
}
