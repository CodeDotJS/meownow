import { clearVault, loadVault } from "./idb";

/** Leftover IndexedDB keys after a server wipe look like a working vault. */
export function isStaleLocalVault(hasServerVault: boolean, hasLocal: boolean): boolean {
	return hasLocal && !hasServerVault;
}

/** Drop local keys that cannot match a vault the server does not have. */
export async function dropStaleLocalVault(hasServerVault: boolean): Promise<boolean> {
	const local = await loadVault();
	if (!isStaleLocalVault(hasServerVault, local !== null)) {
		return false;
	}
	await clearVault();
	return true;
}
