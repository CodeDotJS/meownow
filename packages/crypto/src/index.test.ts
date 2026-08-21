import { expect, test } from "vitest";
import { packageName } from "./index";

test("crypto package is named crypto", () => {
	expect(packageName).toBe("crypto");
});
