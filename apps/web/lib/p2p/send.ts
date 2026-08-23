import { type DcEnvelope, dcEnvelopeSchema } from "@meownow/protocol";

export type PeerLink = {
	send: (envelope: DcEnvelope) => void;
	local: boolean;
};

export async function sendOnMesh(
	peers: PeerLink[],
	envelope: DcEnvelope,
): Promise<{ delivered: number; local: boolean; failed: number }> {
	const parsed = dcEnvelopeSchema.safeParse(envelope);
	if (!parsed.success) {
		return { delivered: 0, local: false, failed: 0 };
	}
	let delivered = 0;
	let failed = 0;
	let local = false;
	for (const peer of peers) {
		try {
			peer.send(parsed.data);
			delivered += 1;
			if (peer.local) {
				local = true;
			}
		} catch {
			failed += 1;
		}
	}
	return { delivered, local, failed };
}

export function shouldPersist(ephemeral: boolean): boolean {
	return !ephemeral;
}
