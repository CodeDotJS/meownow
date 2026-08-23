import { expect, test } from "vitest";
import { ephemeralLivePath } from "./ephemeral";

test("ephemeral prefers the DataChannel, then a live hub, then stays local", () => {
	expect(ephemeralLivePath({ meshDelivered: 1, hubSent: true })).toBe("mesh");
	expect(ephemeralLivePath({ meshDelivered: 0, hubSent: true })).toBe("hub");
	expect(ephemeralLivePath({ meshDelivered: 0, hubSent: false })).toBe("none");
});
