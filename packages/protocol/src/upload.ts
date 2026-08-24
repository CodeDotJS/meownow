import { FILE_MAX_BYTES } from "./capability";
import { z } from "./z";

export const MIB = 1024 * 1024;
export const QUOTA_GRANT_MIN_MB = 25;
export const QUOTA_GRANT_MAX_MB = 100;

export const quotaGrantMbSchema = z.number().int().min(QUOTA_GRANT_MIN_MB).max(QUOTA_GRANT_MAX_MB);

export function quotaMbToBytes(mb: number): number {
	return mb * MIB;
}

export function quotaBytesToMb(bytes: number): number {
	return Math.round(bytes / MIB);
}

export const uploadRequestCreateSchema = z.object({
	requestedMb: quotaGrantMbSchema,
	reason: z.string().min(1).max(240),
});

export const uploadRequestDecideSchema = z
	.object({
		status: z.enum(["approved", "denied"]),
		grantedMb: quotaGrantMbSchema.optional(),
		decisionNote: z.string().max(240).optional(),
	})
	.superRefine((value, ctx) => {
		if (value.status === "approved" && value.grantedMb === undefined) {
			ctx.addIssue({ code: "custom", path: ["grantedMb"] });
		}
	});

export const uploadIntentRequestSchema = z.object({
	kind: z.enum(["image", "file"]),
	byteSize: z
		.number()
		.int()
		.positive()
		.max(FILE_MAX_BYTES + 2_097_152),
	chunkCount: z.number().int().positive().max(1024),
});

export const uploadTicketRequestSchema = z.object({
	blobId: z.string().uuid(),
	purpose: z.enum(["upload", "stat", "download"]),
});

export const uploadCommitRequestSchema = z.object({
	blobId: z.string().uuid(),
	itemId: z.string().uuid(),
	kind: z.enum(["image", "file"]),
	metaCiphertext: z.string().min(1),
	iv: z.string().min(1),
	wrappedKey: z.object({
		iv: z.string().min(1),
		bytes: z.string().min(1),
	}),
	chunkSize: z.number().int().positive(),
	chunkCount: z.number().int().positive(),
	sha256: z.string().min(1),
	expiresAt: z.string(),
});
