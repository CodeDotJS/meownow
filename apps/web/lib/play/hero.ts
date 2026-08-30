import type { PlayStore } from "./store";

export const SIGNED_OUT_HERO = [
	{ href: "/play", label: "Playground" },
	{ href: "/login", label: "Continue with passkey" },
] as const;

export async function discardPlayIfLocal(hasLocal: boolean, store: PlayStore): Promise<void> {
	if (hasLocal) {
		await store.clear();
	}
}
