import { z } from "zod";
import { FILE_MAX_BYTES } from "./capability";

export const uploadRequestCreateSchema = z.object({
	reason: z.string().min(1).max(240),
});

export const uploadRequestDecideSchema = z.object({
	status: z.enum(["approved", "denied"]),
	grantedBytes: z
		.number()
		.int()
		.positive()
		.max(FILE_MAX_BYTES * 5)
		.optional(),
	decisionNote: z.string().max(240).optional(),
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
