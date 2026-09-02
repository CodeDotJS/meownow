import { expect, test } from "vitest";
import { nextHeadProgress } from "./head-progress";

test("busy starts the hairline and a release finishes it", () => {
	expect(nextHeadProgress("idle", true)).toBe("busy");
	expect(nextHeadProgress("busy", true)).toBe("busy");
	expect(nextHeadProgress("busy", false)).toBe("done");
	expect(nextHeadProgress("done", false)).toBe("done");
	expect(nextHeadProgress("idle", false)).toBe("idle");
});
