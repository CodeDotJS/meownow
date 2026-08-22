import { type WsEnvelope, wsEnvelopeSchema } from "@meownow/protocol";
import { getJson } from "../client/http";

export type HubSession = {
	send: (envelope: WsEnvelope) => void;
	close: () => void;
};

export function connectHub(onEnvelope: (envelope: WsEnvelope) => void): HubSession {
	let closed = false;
	let socket: WebSocket | null = null;

	async function open(): Promise<void> {
		if (closed) {
			return;
		}
		const res = await getJson("/api/hub/ticket");
		if (closed) {
			return;
		}
		if (!res.ok) {
			window.setTimeout(() => void open(), 2000);
			return;
		}
		const payload = res.data as { ticket: string; url: string };
		socket = new WebSocket(`${payload.url}?ticket=${encodeURIComponent(payload.ticket)}`);
		socket.onmessage = (event) => {
			if (typeof event.data !== "string") {
				return;
			}
			try {
				const parsed = wsEnvelopeSchema.safeParse(JSON.parse(event.data));
				if (parsed.success) {
					onEnvelope(parsed.data);
				}
			} catch {
				return;
			}
		};
		socket.onclose = () => {
			if (!closed) {
				window.setTimeout(() => void open(), 2000);
			}
		};
	}

	void open();
	return {
		send(envelope) {
			if (socket?.readyState === WebSocket.OPEN) {
				socket.send(JSON.stringify(envelope));
			}
		},
		close() {
			closed = true;
			socket?.close();
		},
	};
}
