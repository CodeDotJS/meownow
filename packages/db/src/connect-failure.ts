const CONNECT_CODES = new Set([
	"UND_ERR_CONNECT_TIMEOUT",
	"ETIMEDOUT",
	"ENETUNREACH",
	"EHOSTUNREACH",
	"ECONNREFUSED",
	"EAI_AGAIN",
]);

function walk(error: unknown, codes: Set<string>, messages: string[]): void {
	if (!error || typeof error !== "object") {
		return;
	}
	if ("code" in error && typeof error.code === "string") {
		codes.add(error.code);
	}
	if ("message" in error && typeof error.message === "string") {
		messages.push(error.message);
	}
	if ("cause" in error) {
		walk(error.cause, codes, messages);
	}
}

export function isConnectFailure(error: unknown): boolean {
	const codes = new Set<string>();
	const messages: string[] = [];
	walk(error, codes, messages);
	if ([...codes].some((code) => CONNECT_CODES.has(code))) {
		return true;
	}
	return messages.some(
		(message) =>
			message.includes("Connect Timeout") ||
			message.includes("fetch failed") ||
			message.includes("Error connecting to database"),
	);
}
