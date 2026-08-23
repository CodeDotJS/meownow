import type { WsEnvelope } from "@meownow/protocol";
import { connectHub, type HubSession } from "./live";

type EnvelopeFn = (envelope: WsEnvelope) => void;
type LiveFn = (live: boolean) => void;

const envelopes = new Set<EnvelopeFn>();
const lives = new Set<LiveFn>();
let session: HubSession | null = null;
let live = false;

function fanLive(next: boolean): void {
	live = next;
	for (const listener of lives) {
		listener(next);
	}
}

function fanEnvelope(envelope: WsEnvelope): void {
	if (envelope.type === "hello") {
		fanLive(true);
	}
	for (const listener of envelopes) {
		listener(envelope);
	}
}

function start(): void {
	if (!session) {
		session = connectHub(fanEnvelope, fanLive);
	}
}

function stopIfIdle(): void {
	if (envelopes.size > 0 || lives.size > 0) {
		return;
	}
	session?.close();
	session = null;
	live = false;
}

export function subscribeHub(input: { onEnvelope?: EnvelopeFn; onLive?: LiveFn }): () => void {
	if (input.onEnvelope) {
		envelopes.add(input.onEnvelope);
	}
	if (input.onLive) {
		lives.add(input.onLive);
		input.onLive(live);
	}
	start();
	return () => {
		if (input.onEnvelope) {
			envelopes.delete(input.onEnvelope);
		}
		if (input.onLive) {
			lives.delete(input.onLive);
		}
		stopIfIdle();
	};
}

export function hubSend(envelope: WsEnvelope): boolean {
	return session?.send(envelope) ?? false;
}

export function resetHubLiveForTests(): void {
	session?.close();
	session = null;
	live = false;
	envelopes.clear();
	lives.clear();
}
