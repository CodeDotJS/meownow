export const SESSION_SLIDING_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_HARD_CAP_MS = 90 * 24 * 60 * 60 * 1000;

export function nextSessionExpiry(createdAt: Date, now: Date): Date | null {
	const hard = createdAt.getTime() + SESSION_HARD_CAP_MS;
	if (now.getTime() >= hard) {
		return null;
	}
	return new Date(Math.min(now.getTime() + SESSION_SLIDING_MS, hard));
}
