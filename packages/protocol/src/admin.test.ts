import { expect, test } from "vitest";
import { adminUsageResponseSchema, R2_CLASS_A_CEILING, R2_STORAGE_CEILING_BYTES } from "./admin";

test("usage response pins R2 bytes against the 10 GiB free-tier ceiling", () => {
	const parsed = adminUsageResponseSchema.parse({
		r2CommittedBytes: 12,
		r2PendingBytes: 0,
		r2CeilingBytes: R2_STORAGE_CEILING_BYTES,
		classAEstimate: 3,
		classACeiling: R2_CLASS_A_CEILING,
		classBCounted: false,
		classBCeiling: 10_000_000,
		seatsClaimed: 1,
		seatsTotal: 10,
		users: [{ handle: "rishi", storageUsedBytes: 12, storageQuotaBytes: 524_288_000 }],
	});
	expect(parsed.r2CeilingBytes).toBe(10 * 1024 * 1024 * 1024);
	expect(parsed.r2CommittedBytes).toBeLessThan(parsed.r2CeilingBytes);
	expect(
		adminUsageResponseSchema.safeParse({
			...parsed,
			r2CeilingBytes: 1,
		}).success,
	).toBe(false);
});
