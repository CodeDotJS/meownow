export function originAllowed(request: Request, appUrl: string): boolean {
	const origin = request.headers.get("origin");
	if (!origin) {
		return false;
	}
	return origin === new URL(appUrl).origin;
}
