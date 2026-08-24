import { expect, test } from "vitest";
import {
	QUOTA_GRANT_MAX_MB,
	QUOTA_GRANT_MIN_MB,
	quotaMbToBytes,
	uploadRequestCreateSchema,
	uploadRequestDecideSchema,
} from "./upload";

test("upload quota grants are whole megabytes from 25 to 100", () => {
	expect(QUOTA_GRANT_MIN_MB).toBe(25);
	expect(QUOTA_GRANT_MAX_MB).toBe(100);
	expect(quotaMbToBytes(25)).toBe(25 * 1024 * 1024);
	expect(uploadRequestCreateSchema.parse({ requestedMb: 40, reason: "screenshots" })).toEqual({
		requestedMb: 40,
		reason: "screenshots",
	});
	expect(
		uploadRequestCreateSchema.safeParse({ requestedMb: 24, reason: "too small" }).success,
	).toBe(false);
	expect(uploadRequestCreateSchema.safeParse({ requestedMb: 101, reason: "too big" }).success).toBe(
		false,
	);
	expect(uploadRequestCreateSchema.safeParse({ reason: "no size" }).success).toBe(false);
	expect(uploadRequestDecideSchema.parse({ status: "approved", grantedMb: 25 }).grantedMb).toBe(25);
	expect(uploadRequestDecideSchema.safeParse({ status: "approved" }).success).toBe(false);
	expect(uploadRequestDecideSchema.safeParse({ status: "approved", grantedMb: 500 }).success).toBe(
		false,
	);
	expect(uploadRequestDecideSchema.parse({ status: "denied" }).status).toBe("denied");
});
