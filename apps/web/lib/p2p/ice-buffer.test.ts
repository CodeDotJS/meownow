import { expect, test } from "vitest";
import { IceBuffer } from "./ice-buffer";

test("IceBuffer holds trickle candidates until the offer is applied", () => {
	const buffer = new IceBuffer();
	buffer.push("peer", { candidate: "typ host", sdpMid: "0", sdpMLineIndex: 0 });
	buffer.push("peer", { candidate: "typ srflx", sdpMid: "0", sdpMLineIndex: 0 });
	expect(buffer.take("peer")).toHaveLength(2);
	expect(buffer.take("peer")).toEqual([]);
});
