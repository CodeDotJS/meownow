const WARN_MS = 3 * 60 * 60 * 1000;
const MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(ms: number): Date {
	const start = new Date(ms);
	start.setHours(0, 0, 0, 0);
	return start;
}

function pad(value: number): string {
	return String(value).padStart(2, "0");
}

export function formatClockTime(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) {
		return "--:--";
	}
	return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDayLabel(
	iso: string,
	now = Date.now(),
): { key: string; title: string; date: string } {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) {
		return { key: "unknown", title: "Unknown", date: "" };
	}
	const that = startOfDay(date.getTime());
	const today = startOfDay(now);
	const key = `${that.getFullYear()}-${pad(that.getMonth() + 1)}-${pad(that.getDate())}`;
	const month = MONTHS[that.getMonth()] ?? "";
	const dateLabel = `${that.getDate()} ${month}`.trim();
	const diff = Math.round((today.getTime() - that.getTime()) / DAY_MS);
	if (diff === 0) {
		return { key, title: "Today", date: dateLabel };
	}
	if (diff === 1) {
		return { key, title: "Yesterday", date: dateLabel };
	}
	return { key, title: dateLabel, date: "" };
}

export function groupByDay<T extends { createdAt: string }>(
	items: T[],
	now = Date.now(),
): Array<{ key: string; title: string; date: string; items: T[] }> {
	const groups: Array<{ key: string; title: string; date: string; items: T[] }> = [];
	for (const item of items) {
		const day = formatDayLabel(item.createdAt, now);
		const last = groups[groups.length - 1];
		if (last && last.key === day.key) {
			last.items.push(item);
			continue;
		}
		groups.push({ ...day, items: [item] });
	}
	return groups;
}

export function formatGutterTime(iso: string, now = Date.now()): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) {
		return "--:--";
	}
	const start = startOfDay(now);
	if (date.getTime() >= start.getTime()) {
		return formatClockTime(iso);
	}
	return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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
