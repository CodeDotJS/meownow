export type IceInit = {
	candidate: string;
	sdpMid: string | null;
	sdpMLineIndex: number | null;
};

export class IceBuffer {
	private readonly pending = new Map<string, IceInit[]>();

	push(peerId: string, candidate: IceInit): void {
		const list = this.pending.get(peerId);
		if (list) {
			list.push(candidate);
			return;
		}
		this.pending.set(peerId, [candidate]);
	}

	take(peerId: string): IceInit[] {
		const list = this.pending.get(peerId) ?? [];
		this.pending.delete(peerId);
		return list;
	}

	clear(peerId: string): void {
		this.pending.delete(peerId);
	}
}
