import { expect, test } from "vitest";
import { isHostCandidate, isLanPair } from "./lan";

test("host ICE candidates classify as Local", () => {
	expect(
		isHostCandidate("candidate:1 1 UDP 2130706431 192.168.1.8 54321 typ host generation 0"),
	).toBe(true);
	expect(
		isHostCandidate(
			"candidate:2 1 UDP 1694498815 1.2.3.4 54321 typ srflx raddr 192.168.1.8 rport 54321",
		),
	).toBe(false);
	expect(isLanPair("host", "host")).toBe(true);
	expect(isLanPair("host", "srflx")).toBe(false);
});
