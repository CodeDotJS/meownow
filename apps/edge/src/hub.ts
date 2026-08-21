import type { WsEnvelope } from "@meownow/protocol";

export type SocketSink = {
	deviceId: string;
	send: (data: string) => void;
};

const RTC_TYPES = new Set(["rtc.offer", "rtc.answer", "rtc.ice"]);

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

	sendTo(deviceId: string, envelope: WsEnvelope): boolean {
		const payload = JSON.stringify(envelope);
		let hit = false;
		for (const sink of this.sockets) {
			if (sink.deviceId === deviceId) {
				sink.send(payload);
				hit = true;
			}
		}
		return hit;
	}

	route(envelope: WsEnvelope): void {
		if (RTC_TYPES.has(envelope.type) && "to" in envelope && typeof envelope.to === "string") {
			this.sendTo(envelope.to, envelope);
			return;
		}
		this.broadcast(envelope);
	}

	presence(): string[] {
		return [...new Set([...this.sockets].map((sink) => sink.deviceId))].sort();
	}

	get size(): number {
		return this.sockets.size;
	}
}
