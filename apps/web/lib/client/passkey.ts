const PASSKEY_ID_KEY = "meownow.passkey-id";

export function readRememberedPasskey(): string | null {
	try {
		const value = window.localStorage.getItem(PASSKEY_ID_KEY);
		return value && value.length > 0 ? value : null;
	} catch {
		return null;
	}
}

export function rememberPasskey(id: string): void {
	try {
		window.localStorage.setItem(PASSKEY_ID_KEY, id);
	} catch {
		// Private mode can block storage; login still works without the hint.
	}
}

export function preferRememberedPasskey<T>(options: T, remembered: string | null): T {
	if (!remembered) {
		return options;
	}
	return {
		...options,
		allowCredentials: [{ id: remembered, type: "public-key" as const }],
	} as T;
}

export function shouldRetryUsernameless(remembered: string | null, error: string): boolean {
	return Boolean(remembered) && (error === "unverified" || error === "device_revoked");
}

export async function waitForSession(
	probe: () => Promise<boolean>,
	pause: (ms: number) => Promise<void>,
): Promise<boolean> {
	for (let attempt = 0; attempt < 6; attempt += 1) {
		if (await probe()) {
			return true;
		}
		await pause(50);
	}
	return false;
}
