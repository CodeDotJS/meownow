import { z } from "zod";

export const errorCodeSchema = z.enum([
	"invalid_origin",
	"invalid_body",
	"invalid_challenge",
	"invite_invalid",
	"invite_expired",
	"invite_revoked",
	"invite_redeemed",
	"handle_taken",
	"seats_full",
	"unauthorized",
	"forbidden",
	"unverified",
	"admin_enrolled",
	"suspended",
	"device_revoked",
	"vault_exists",
	"vault_missing",
	"pairing_expired",
	"pairing_missing",
	"pairing_complete",
	"recovery_invalid",
	"item_invalid",
	"item_expired",
	"hub_unconfigured",
	"push_unconfigured",
	"capability_unconfigured",
	"quota_exceeded",
	"request_pending",
	"not_found",
	"last_admin",
	"rate_limited",
]);

export const errorEnvelopeSchema = z.object({
	error: errorCodeSchema,
});

export const handleSchema = z
	.string()
	.min(2)
	.max(32)
	.regex(/^[a-z0-9_]+$/);

export const displayNameSchema = z.string().min(1).max(64);
export const deviceLabelSchema = z.string().min(1).max(64);
export const inviteTokenSchema = z.string().min(32).max(64);

export const inviteCreateRequestSchema = z.object({
	note: z.string().max(120).optional(),
});

export const inviteCreateResponseSchema = z.object({
	id: z.string().uuid(),
	token: z.string(),
	expiresAt: z.string(),
});

export const inviteRevokeResponseSchema = z.object({
	ok: z.literal(true),
});

export const inviteListItemSchema = z.object({
	id: z.string().uuid(),
	note: z.string().nullable(),
	expiresAt: z.string(),
	redeemedAt: z.string().nullable(),
	revokedAt: z.string().nullable(),
	createdAt: z.string(),
});

export const inviteListResponseSchema = z.object({
	invites: z.array(inviteListItemSchema),
});

export const registerOptionsRequestSchema = z.object({
	token: inviteTokenSchema,
	handle: handleSchema,
	displayName: displayNameSchema,
	deviceLabel: deviceLabelSchema,
});

export const adminEnrollOptionsRequestSchema = z.object({
	handle: handleSchema,
	secret: z.string().min(16),
	deviceLabel: deviceLabelSchema,
});

export const loginOptionsRequestSchema = z.object({}).strict();

export const webAuthnRegistrationResponseSchema = z.object({
	id: z.string().min(1),
	rawId: z.string().min(1),
	type: z.literal("public-key"),
	response: z.object({
		clientDataJSON: z.string().min(1),
		attestationObject: z.string().min(1),
		authenticatorData: z.string().optional(),
		transports: z.array(z.string()).optional(),
		publicKeyAlgorithm: z.number().optional(),
		publicKey: z.string().optional(),
	}),
	clientExtensionResults: z.record(z.string(), z.unknown()).optional(),
	authenticatorAttachment: z.string().optional(),
});

export const webAuthnAuthenticationResponseSchema = z.object({
	id: z.string().min(1),
	rawId: z.string().min(1),
	type: z.literal("public-key"),
	response: z.object({
		clientDataJSON: z.string().min(1),
		authenticatorData: z.string().min(1),
		signature: z.string().min(1),
		userHandle: z.string().nullable().optional(),
	}),
	clientExtensionResults: z.record(z.string(), z.unknown()).optional(),
	authenticatorAttachment: z.string().optional(),
});

export const registerVerifyRequestSchema = z.object({
	credential: webAuthnRegistrationResponseSchema,
});

export const loginVerifyRequestSchema = z.object({
	credential: webAuthnAuthenticationResponseSchema,
	challenge: z.string().min(1).optional(),
});

export const okHandleResponseSchema = z.object({
	ok: z.literal(true),
	handle: z.string(),
});

export const meResponseSchema = z.object({
	id: z.string().uuid(),
	handle: z.string(),
	displayName: z.string(),
	role: z.enum(["admin", "member"]),
	canUpload: z.boolean(),
	hasVault: z.boolean(),
	storageQuotaBytes: z.number().int().nonnegative(),
	storageUsedBytes: z.number().int().nonnegative(),
});

export const logoutResponseSchema = z.object({
	ok: z.literal(true),
});

export const accountDeleteRequestSchema = z.object({
	handle: handleSchema,
});

export const accountDeleteResponseSchema = z.object({
	ok: z.literal(true),
});

export const publicKeyOptionsResponseSchema = z.object({
	options: z.unknown(),
	challenge: z.string().min(1).optional(),
});

export type ErrorCode = z.infer<typeof errorCodeSchema>;
export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;
export type InviteCreateRequest = z.infer<typeof inviteCreateRequestSchema>;
export type InviteCreateResponse = z.infer<typeof inviteCreateResponseSchema>;
export type RegisterOptionsRequest = z.infer<typeof registerOptionsRequestSchema>;
export type AdminEnrollOptionsRequest = z.infer<typeof adminEnrollOptionsRequestSchema>;
export type RegisterVerifyRequest = z.infer<typeof registerVerifyRequestSchema>;
export type LoginVerifyRequest = z.infer<typeof loginVerifyRequestSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
