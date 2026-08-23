import { afterEach, expect, test, vi } from "vitest";
import {
	dismissTransportNotice,
	publishTransportNotice,
	readTransportNotice,
	resetTransportNoticeForTests,
	subscribeTransportNotice,
	TRANSPORT_NOTICE_HEADER,
} from "./transport-notice";

afterEach(() => {
	vi.unstubAllGlobals();
	resetTransportNoticeForTests();
});

test("readTransportNotice publishes ipv6_unreachable from the response header", () => {
	const seen: Array<string | null> = [];
	const stop = subscribeTransportNotice((notice) => {
		seen.push(notice);
	});
	readTransportNotice(
		new Response(null, { headers: { [TRANSPORT_NOTICE_HEADER]: "ipv6_unreachable" } }),
	);
	expect(seen).toEqual([null, "ipv6_unreachable"]);
	stop();
});

test("dismissed notices stay hidden when sessionStorage is unavailable", () => {
	const seen: Array<string | null> = [];
	const stop = subscribeTransportNotice((notice) => {
		seen.push(notice);
	});
	vi.stubGlobal("sessionStorage", {
		getItem: () => {
			throw new Error("blocked");
		},
		setItem: () => {
			throw new Error("blocked");
		},
		removeItem: () => {
			throw new Error("blocked");
		},
	});
	publishTransportNotice("ipv6_unreachable");
	dismissTransportNotice("ipv6_unreachable");
	publishTransportNotice("ipv6_unreachable");
	expect(seen).toEqual([null, "ipv6_unreachable", null]);
	stop();
});

test("dismissed notices are not published again this session", () => {
	const seen: Array<string | null> = [];
	const stop = subscribeTransportNotice((notice) => {
		seen.push(notice);
	});
	publishTransportNotice("ipv6_unreachable");
	dismissTransportNotice("ipv6_unreachable");
	publishTransportNotice("ipv6_unreachable");
	expect(seen).toEqual([null, "ipv6_unreachable", null]);
	stop();
});

test("readTransportNotice ignores other headers", () => {
	const listener = vi.fn();
	const stop = subscribeTransportNotice(listener);
	readTransportNotice(new Response(null));
	expect(listener).toHaveBeenCalledWith(null);
	expect(listener).toHaveBeenCalledTimes(1);
	stop();
});
