import { expect, test } from "vitest";
import { adminSeed, DEFAULT_QUOTA_BYTES, SEAT_COUNT, seatNumbers } from "./seed";

test("seatNumbers is 1 through 10", () => {
	expect(seatNumbers()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test("seatNumbers has no eleventh seat", () => {
	expect(seatNumbers()).not.toContain(11);
	expect(seatNumbers()).toHaveLength(SEAT_COUNT);
});

test("admin seed defaults handle to rishi with upload rights and 500MB quota", () => {
	const admin = adminSeed({});
	expect(admin.handle).toBe("rishi");
	expect(admin.canUpload).toBe(true);
	expect(admin.role).toBe("admin");
	expect(admin.storageQuotaBytes).toBe(DEFAULT_QUOTA_BYTES);
	expect(DEFAULT_QUOTA_BYTES).toBe(524_288_000);
});

test("admin seed uses SEED_ADMIN_HANDLE when provided", () => {
	expect(adminSeed({ SEED_ADMIN_HANDLE: "ada" }).handle).toBe("ada");
});
