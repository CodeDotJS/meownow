const WARN_MS = 3 * 60 * 60 * 1000;

export function formatGutterTime(iso: string, now = Date.now()): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) {
		return "--:--";
	}
	const start = new Date(now);
	start.setHours(0, 0, 0, 0);
	if (date.getTime() >= start.getTime()) {
		const hh = String(date.getHours()).padStart(2, "0");
		const mm = String(date.getMinutes()).padStart(2, "0");
		return `${hh}:${mm}`;
	}
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${month}-${day}`;
}

export function isLiveItem(expiresAt: string, now = Date.now()): boolean {
	const expires = Date.parse(expiresAt);
	return !Number.isNaN(expires) && expires > now;
}

export function ttlWarn(expiresAt: string, now = Date.now()): boolean {
	const left = Date.parse(expiresAt) - now;
	return left > 0 && left <= WARN_MS;
}

export function ttlRemain(expiresAt: string, ttlMs: number, now = Date.now()): number {
	if (ttlMs <= 0) {
		return 0;
	}
	return Math.max(0, Math.min(1, (Date.parse(expiresAt) - now) / ttlMs));
}
