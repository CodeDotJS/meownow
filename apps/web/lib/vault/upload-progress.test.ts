import { expect, test } from "vitest";
import { blobUploadProgress } from "./upload-progress";

test("upload progress climbs from read to commit", () => {
	const read = blobUploadProgress("read");
	const encrypt = blobUploadProgress("encrypt");
	const first = blobUploadProgress("chunk", 0, 3);
	const last = blobUploadProgress("chunk", 2, 3);
	const done = blobUploadProgress("commit");
	expect(read).toBeGreaterThan(0);
	expect(encrypt).toBeGreaterThan(read);
	expect(first).toBeGreaterThan(encrypt);
	expect(last).toBeGreaterThan(first);
	expect(done).toBe(1);
	expect(last).toBeLessThan(1);
});
