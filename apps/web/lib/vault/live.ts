import {
	HUB_PING,
	HUB_PING_INTERVAL_MS,
	HUB_SILENCE_LIMIT_MS,
	type WsEnvelope,
	wsEnvelopeSchema,
} from "@meownow/protocol";
import { getJson } from "../client/http";

export type HubSession = {
	send: (envelope: WsEnvelope) => void;
	close: () => void;
};

const RETRY_MS = 2000;

export function connectHub(
	onEnvelope: (envelope: WsEnvelope) => void,
	onLive?: (live: boolean) => void,
): HubSession {
	let closed = false;
	let socket: WebSocket | null = null;
	let timers: number[] = [];
	let lastSeen = Date.now();

	function stopTimers(): void {
		for (const id of timers) {
			window.clearInterval(id);
		}
		timers = [];
	}

	function retry(): void {
		stopTimers();
		onLive?.(false);
		if (closed) {
			return;
		}
		window.setTimeout(() => void open(), RETRY_MS);
	}

	async function open(): Promise<void> {
		if (closed) {
			return;
		}
		const res = await getJson("/api/hub/ticket");
		if (closed) {
			return;
		}
		if (!res.ok) {
			retry();
			return;
		}
		const payload = res.data as { ticket: string; url: string };
		const ws = new WebSocket(`${payload.url}?ticket=${encodeURIComponent(payload.ticket)}`);
		socket = ws;
		lastSeen = Date.now();
		ws.onopen = () => {
			lastSeen = Date.now();
			timers.push(
				window.setInterval(() => {
					if (ws.readyState === WebSocket.OPEN) {
						ws.send(HUB_PING);
					}
				}, HUB_PING_INTERVAL_MS),
			);
			timers.push(
				window.setInterval(() => {
					// A half-open socket keeps readyState OPEN and never fires onclose,
					// so silence is the only symptom. Closing it triggers the retry.
					if (Date.now() - lastSeen > HUB_SILENCE_LIMIT_MS) {
						ws.close();
					}
				}, HUB_PING_INTERVAL_MS),
			);
		};
		ws.onmessage = (event) => {
			lastSeen = Date.now();
			if (typeof event.data !== "string") {
				return;
			}
			try {
				const parsed = wsEnvelopeSchema.safeParse(JSON.parse(event.data));
				if (!parsed.success || parsed.data.type === "ping" || parsed.data.type === "pong") {
					return;
				}
				onEnvelope(parsed.data);
			} catch {
				return;
			}
		};
		ws.onerror = () => ws.close();
		ws.onclose = () => {
			if (socket === ws) {
				retry();
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
			stopTimers();
			socket?.close();
		},
	};
}
