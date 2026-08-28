import { normalizePairingCode, PAIRING_CODE_LENGTH } from "./pairing-code";
import { z } from "./z";

export const TEXT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const PAIRING_TTL_MS = 5 * 60 * 1000;

export const publicJwkSchema = z
	.object({
		kty: z.string(),
		crv: z.string().optional(),
		x: z.string(),
		y: z.string(),
	})
	.passthrough();

export const wrappedKeyWireSchema = z.object({
	iv: z.string().min(1),
	bytes: z.string().min(1),
});

export const vaultPutRequestSchema = z.object({
	identityPub: publicJwkSchema,
	wrappedVaultRecovery: wrappedKeyWireSchema,
	recoverySalt: z.string().min(1),
	recoveryVerifier: z.string().min(1),
});

export const vaultRecoveryRequestSchema = z.object({
	handle: z
		.string()
		.min(2)
		.max(32)
		.regex(/^[a-z0-9_]+$/),
});

export const vaultRecoveryResponseSchema = z.object({
	recoverySalt: z.string(),
	wrappedVaultRecovery: wrappedKeyWireSchema,
});

export const pairingStartRequestSchema = z.object({
	publicJwk: publicJwkSchema,
});

export const pairingStartResponseSchema = z.object({
	id: z.string().uuid(),
	code: z.string().length(PAIRING_CODE_LENGTH),
	expiresAt: z.string(),
});

export const pairingLookupRequestSchema = z.object({
	code: z
		.string()
		.min(1)
		.transform((value, ctx) => {
			const normalized = normalizePairingCode(value);
			if (!normalized) {
				ctx.addIssue({ code: "custom", message: "pairing_code" });
				return z.NEVER;
			}
			return normalized;
		}),
});

export const pairingWrapRequestSchema = z.object({
	fingerprint: z.string().regex(/^\d{6}$/),
	vaultWrap: wrappedKeyWireSchema.extend({
		ephPublicJwk: publicJwkSchema,
	}),
	identityWrap: wrappedKeyWireSchema,
	identityPub: publicJwkSchema,
});

export const pairingGetResponseSchema = z.object({
	id: z.string().uuid(),
	expiresAt: z.string(),
	publicJwk: publicJwkSchema,
	handle: z.string().nullable(),
	wrap: pairingWrapRequestSchema.nullable(),
});

export const itemKindSchema = z.enum(["text", "link", "image", "file"]);

export const itemCreateRequestSchema = z.object({
	id: z.string().uuid(),
	kind: z.enum(["text", "link"]),
	ciphertext: z.string().min(1),
	metaCiphertext: z.string().min(1),
	iv: z.string().min(1),
	byteSize: z.number().int().nonnegative(),
	expiresAt: z.string(),
});

export const itemUpdateRequestSchema = z
	.object({
		kind: z.enum(["text", "link"]),
		ciphertext: z.string().min(1),
		metaCiphertext: z.string().min(1),
		iv: z.string().min(1),
		byteSize: z.number().int().nonnegative(),
	})
	.strict();

export const itemRecordSchema = z.object({
	id: z.string().uuid(),
	kind: itemKindSchema,
	ciphertext: z.string().min(1).optional(),
	metaCiphertext: z.string().min(1),
	iv: z.string().min(1),
	wrappedKey: wrappedKeyWireSchema.optional(),
	blobId: z.string().uuid().optional(),
	byteSize: z.number().int().nonnegative(),
	expiresAt: z.string(),
	createdAt: z.string(),
});

export const itemListResponseSchema = z.object({
	items: z.array(itemRecordSchema),
});

export const pairingQrSchema = z.object({
	v: z.literal(1),
	id: z.string().uuid(),
	publicJwk: publicJwkSchema,
});

export const pushSubscribeRequestSchema = z.object({
	endpoint: z.string().url(),
	keys: z.object({
		p256dh: z.string().min(1),
		auth: z.string().min(1),
	}),
});

export type PublicJwk = z.infer<typeof publicJwkSchema>;
export type WrappedKeyWire = z.infer<typeof wrappedKeyWireSchema>;
export type VaultPutRequest = z.infer<typeof vaultPutRequestSchema>;
export type PairingStartRequest = z.infer<typeof pairingStartRequestSchema>;
export type PairingWrapRequest = z.infer<typeof pairingWrapRequestSchema>;
export type ItemCreateRequest = z.infer<typeof itemCreateRequestSchema>;
export type ItemUpdateRequest = z.infer<typeof itemUpdateRequestSchema>;
export type ItemRecord = z.infer<typeof itemRecordSchema>;
export type PairingQr = z.infer<typeof pairingQrSchema>;
export type PushSubscribeRequest = z.infer<typeof pushSubscribeRequestSchema>;

export function asPublicJwk(jwk: unknown): PublicJwk {
	const parsed = publicJwkSchema.safeParse(jwk);
	if (!parsed.success) {
		throw new Error("invalid_jwk");
	}
	return parsed.data;
}
