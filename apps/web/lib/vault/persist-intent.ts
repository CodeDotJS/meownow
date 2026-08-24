export type PersistIntent = "live" | "hold" | "queue" | "post";

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
