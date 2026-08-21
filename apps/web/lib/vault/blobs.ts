import { type CapabilityToken, mintCapabilityToken, parseCapabilityJwk } from "@meownow/protocol";

export type BlobPort = {
	stat: (token: string) => Promise<{ bytes: number } | null>;
};

export function silentBlobs(): BlobPort {
	return { stat: async () => ({ bytes: 1 }) };
}

export function createHttpBlobs(edgeUrl?: string): BlobPort {
	return {
		async stat(token) {
			if (!edgeUrl) {
				return null;
			}
			const res = await fetch(`${edgeUrl.replace(/\/$/, "")}/stat`, {
				headers: { authorization: `Bearer ${token}` },
			});
			if (!res.ok) {
				return null;
			}
			const body: unknown = await res.json();
			if (!body || typeof body !== "object" || !("bytes" in body)) {
				return null;
			}
			const bytes = (body as { bytes: unknown }).bytes;
			return typeof bytes === "number" ? { bytes } : null;
		},
	};
}

export async function signCapability(
	privateJwkJson: string,
	token: CapabilityToken,
): Promise<string> {
	return mintCapabilityToken(parseCapabilityJwk(privateJwkJson), token);
}
