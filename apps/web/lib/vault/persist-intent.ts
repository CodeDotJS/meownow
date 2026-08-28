export type PersistIntent = "live" | "hold" | "queue" | "post";
export type EditIntent = "live" | "rewrite" | "dirty" | "patch";

export function persistIntent(input: {
	ephemeral: boolean;
	syncEnabled: boolean;
	online: boolean;
}): PersistIntent {
	if (input.ephemeral) {
		return "live";
	}
	if (!input.syncEnabled) {
		return "hold";
	}
	return input.online ? "post" : "queue";
}

export function editIntent(input: {
	ephemeral: boolean;
	posted: boolean;
	syncEnabled: boolean;
	online: boolean;
}): EditIntent {
	if (input.ephemeral) {
		return "live";
	}
	if (!input.posted) {
		return "rewrite";
	}
	if (!input.syncEnabled || !input.online) {
		return "dirty";
	}
	return "patch";
}
