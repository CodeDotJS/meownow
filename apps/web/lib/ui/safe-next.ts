export function safeNextPath(raw: string | null | undefined): string {
	if (!raw?.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
		return "/";
	}
	return raw;
}
