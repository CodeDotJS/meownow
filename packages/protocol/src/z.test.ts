import { expect, test } from "vitest";
import { z } from "./z";

test("protocol Zod skips the Function constructor probe", () => {
	expect(z.config().jitless).toBe(true);
});
