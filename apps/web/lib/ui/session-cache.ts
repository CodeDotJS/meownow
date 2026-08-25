import { getJson } from "@/lib/client/http";
import { loadVault } from "@/lib/vault/idb";
import { getItemCacheMeta, type LastMe, setItemCacheMeta } from "@/lib/vault/item-cache";
import { dropStaleLocalVault } from "@/lib/vault/local";

export function resolveSession(input: {
	status: number;
	profile: LastMe | null;
	cachedMe: LastMe | null;
	hasLocal: boolean;
}): LastMe | null {
	if (input.status >= 200 && input.status < 300 && input.profile) {
		return input.profile;
	}
	if (input.status === 0 && input.hasLocal && input.cachedMe) {
		return input.cachedMe;
	}
	return null;
}

export function asMenuMe(me: LastMe): {
	handle: string;
	role: LastMe["role"];
	canUpload: boolean;
	hasVault: boolean;
} {
	return {
		handle: me.handle,
		role: me.role,
		canUpload: me.canUpload,
		hasVault: me.hasVault,
	};
}

export function lastMeFromProfile(profile: {
	id: string;
	handle: string;
	displayName: string;
	role: "admin" | "member";
	canUpload: boolean;
	hasVault: boolean;
}): LastMe {
	return {
		id: profile.id,
		handle: profile.handle,
		displayName: profile.displayName,
		role: profile.role,
		canUpload: profile.canUpload,
		hasVault: profile.hasVault,
	};
}

type BrowserSession = {
	me: LastMe | null;
	hasLocal: boolean;
};

let memory: BrowserSession | null = null;

/** Last hydrate in this tab. Null until the first one finishes. */
export function peekBrowserSession(): BrowserSession | null {
	return memory;
}

export function rememberBrowserSession(session: BrowserSession): void {
	memory = session;
}

export function clearBrowserSession(): void {
	memory = null;
}

/** Cookie session still authorizes writes. lastMe is chrome only. */
export async function hydrateBrowserSession(): Promise<BrowserSession> {
	const hasLocal = (await loadVault()) !== null;
	const cachedMe = (await getItemCacheMeta()).lastMe;
	const res = await getJson("/api/auth/me");
	const profile = res.ok
		? lastMeFromProfile(res.data as Parameters<typeof lastMeFromProfile>[0])
		: null;
	const resolved = resolveSession({
		status: res.status,
		profile,
		cachedMe,
		hasLocal,
	});
	if (res.ok && profile) {
		await dropStaleLocalVault(profile.hasVault);
		const stillLocal = (await loadVault()) !== null;
		const meta = await getItemCacheMeta();
		await setItemCacheMeta({ ...meta, lastMe: profile });
		const session = { me: resolved, hasLocal: stillLocal };
		rememberBrowserSession(session);
		return session;
	}
	const session = { me: resolved, hasLocal };
	rememberBrowserSession(session);
	return session;
}
