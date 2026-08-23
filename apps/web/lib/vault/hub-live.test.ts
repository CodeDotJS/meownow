import { afterEach, expect, test, vi } from "vitest";
import { hubSend, resetHubLiveForTests, subscribeHub } from "./hub-live";

const hub = vi.hoisted(() => {
	return {
		onEnvelope: undefined as ((envelope: { type: string }) => void) | undefined,
		onLive: undefined as ((live: boolean) => void) | undefined,
		send: vi.fn(() => true),
		close: vi.fn(),
	};
});

vi.mock("./live", () => ({
	connectHub: (
		onEnvelope: (envelope: { type: string }) => void,
		onLive?: (live: boolean) => void,
	) => {
		hub.onEnvelope = onEnvelope;
		hub.onLive = onLive;
		return {
			send: hub.send,
			close: () => {
				hub.close();
				hub.onLive?.(false);
			},
		};
	},
}));

afterEach(() => {
	resetHubLiveForTests();
	hub.onEnvelope = undefined;
	hub.onLive = undefined;
	hub.send.mockClear();
	hub.close.mockClear();
});

test("one socket fans hello to every subscriber", () => {
	const first = vi.fn();
	const second = vi.fn();
	const live = vi.fn();
	const stopA = subscribeHub({ onEnvelope: first, onLive: live });
	const stopB = subscribeHub({ onEnvelope: second });
	hub.onEnvelope?.({ type: "hello" });
	expect(first).toHaveBeenCalledWith({ type: "hello" });
	expect(second).toHaveBeenCalledWith({ type: "hello" });
	expect(live).toHaveBeenCalledWith(true);
	expect(hubSend({ v: 1, type: "item.deleted", id: "x" })).toBe(true);
	stopA();
	stopB();
	expect(hub.close).toHaveBeenCalled();
});
