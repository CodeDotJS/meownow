/** HTTP catch-up while the hub is down. Not used when the socket is live. */
export const OFFLINE_POLL_MS = 15_000;

export function shouldHttpPoll(input: { live: boolean; visible: boolean }): boolean {
	return input.visible && !input.live;
}
