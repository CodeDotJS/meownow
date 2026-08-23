export function ephemeralLivePath(input: {
	meshDelivered: number;
	hubSent: boolean;
}): "mesh" | "hub" | "none" {
	if (input.meshDelivered > 0) {
		return "mesh";
	}
	if (input.hubSent) {
		return "hub";
	}
	return "none";
}
