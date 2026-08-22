import { expect, test } from "vitest";
import { runCron } from "./cron";

test("cron does not sweep R2 when prune is denied", async () => {
	const deleted: string[] = [];
	const original = globalThis.fetch;
	globalThis.fetch = async () => new Response("no", { status: 401 });
	try {
		await runCron({
			BLOBS: {
				async list() {
					return { objects: [{ key: "gone/0" }] };
				},
				async delete(key: string) {
					deleted.push(key);
				},
			},
			HUB_SECRET: "0".repeat(32),
			APP_URL: "https://meownow.example",
		});
	} finally {
		globalThis.fetch = original;
	}
	expect(deleted).toEqual([]);
});
