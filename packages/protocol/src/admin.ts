import { z } from "zod";

export const R2_STORAGE_CEILING_BYTES = 10 * 1024 * 1024 * 1024;
export const R2_CLASS_A_CEILING = 1_000_000;
export const R2_CLASS_B_CEILING = 10_000_000;
export const SEAT_CEILING = 10;

export const adminDeviceSchema = z.object({
	id: z.string().uuid(),
	label: z.string(),
	revokedAt: z.string().nullable(),
	lastSeenAt: z.string().nullable(),
	createdAt: z.string(),
});

export const adminUserSchema = z.object({
	id: z.string().uuid(),
	handle: z.string(),
	displayName: z.string(),
	role: z.enum(["admin", "member"]),
	canUpload: z.boolean(),
	storageQuotaBytes: z.number().int().nonnegative(),
	storageUsedBytes: z.number().int().nonnegative(),
	suspendedAt: z.string().nullable(),
	devices: z.array(adminDeviceSchema),
});

export const adminUsersResponseSchema = z.object({
	users: z.array(adminUserSchema),
	seatsClaimed: z.number().int().nonnegative(),
	seatsTotal: z.literal(SEAT_CEILING),
});

export const adminAuditEntrySchema = z.object({
	id: z.number().int(),
	actorId: z.string().uuid().nullable(),
	action: z.string(),
	subjectType: z.string().nullable(),
	subjectId: z.string().uuid().nullable(),
	createdAt: z.string(),
});

export const adminAuditResponseSchema = z.object({
	entries: z.array(adminAuditEntrySchema),
});

export const adminUsageUserSchema = z.object({
	handle: z.string(),
	storageUsedBytes: z.number().int().nonnegative(),
	storageQuotaBytes: z.number().int().nonnegative(),
});

export const adminUsageResponseSchema = z.object({
	r2CommittedBytes: z.number().int().nonnegative(),
	r2PendingBytes: z.number().int().nonnegative(),
	r2CeilingBytes: z.literal(R2_STORAGE_CEILING_BYTES),
	classAEstimate: z.number().int().nonnegative(),
	classACeiling: z.literal(R2_CLASS_A_CEILING),
	classBCounted: z.literal(false),
	classBCeiling: z.literal(R2_CLASS_B_CEILING),
	seatsClaimed: z.number().int().nonnegative(),
	seatsTotal: z.literal(SEAT_CEILING),
	users: z.array(adminUsageUserSchema),
});

export const adminOkResponseSchema = z.object({
	ok: z.literal(true),
});

export const pruneResponseSchema = z.object({
	keepR2Keys: z.array(z.string()),
	deleteR2Keys: z.array(z.string()),
});
