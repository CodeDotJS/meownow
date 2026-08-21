import type { WsEnvelope } from "@meownow/protocol";

export type SocketSink = {
	deviceId: string;
	send: (data: string) => void;
};

export class HubRoom {
	private readonly sockets = new Set<SocketSink>();

	add(sink: SocketSink): void {
		this.sockets.add(sink);
	}

	remove(sink: SocketSink): void {
		this.sockets.delete(sink);
	}

	broadcast(envelope: WsEnvelope): number {
		const payload = JSON.stringify(envelope);
		for (const sink of this.sockets) {
			sink.send(payload);
		}
		return this.sockets.size;
	}

	get size(): number {
		return this.sockets.size;
	}
}
