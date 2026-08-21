import { expect, test } from "vitest";
import { sweepOrphans } from "./prune";

test("sweep deletes R2 objects whose prefix is not in the keep set", async () => {
	const store = new Map<string, true>([
		["keep/0", true],
		["gone/0", true],
		["gone/1", true],
	]);
	const deleted = await sweepOrphans(
		{
			async list() {
				return { objects: [...store.keys()].map((key) => ({ key })) };
			},
			async delete(key) {
				store.delete(key);
			},
		},
		new Set(["keep"]),
	);
	expect(deleted).toBe(2);
	expect([...store.keys()]).toEqual(["keep/0"]);
});
