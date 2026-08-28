import { z } from "./z";

export const protocolVersionSchema = z.literal(1);

export type ProtocolVersion = z.infer<typeof protocolVersionSchema>;

export {
	adminAuditResponseSchema,
	adminOkResponseSchema,
	adminUsageResponseSchema,
	adminUsersResponseSchema,
	pruneResponseSchema,
	R2_CLASS_A_CEILING,
	R2_CLASS_B_CEILING,
	R2_STORAGE_CEILING_BYTES,
	SEAT_CEILING,
} from "./admin";
export type { CapabilityToken } from "./capability";
export {
	BLOB_TTL_MS,
	CAPABILITY_TTL_MS,
	FILE_MAX_BYTES,
	generateCapabilityKeyPair,
	MAX_CHUNK_CIPHER_BYTES,
	mintCapabilityToken,
	openCapabilityToken,
	PENDING_BLOB_MAX_AGE_MS,
	parseCapabilityJwk,
} from "./capability";
export type { DcEnvelope } from "./dc";
export { dcEnvelopeSchema } from "./dc";
export type {
	AdminEnrollOptionsRequest,
	ErrorCode,
	ErrorEnvelope,
	InviteAskListResponse,
	InviteCreateRequest,
	InviteCreateResponse,
	LoginVerifyRequest,
	MeResponse,
	RegisterOptionsRequest,
	RegisterVerifyRequest,
} from "./http";
export {
	ASK_OPEN_MAX,
	accountDeleteRequestSchema,
	accountDeleteResponseSchema,
	adminEnrollOptionsRequestSchema,
	deviceLabelSchema,
	displayNameSchema,
	errorCodeSchema,
	errorEnvelopeSchema,
	handleSchema,
	inviteAskListItemSchema,
	inviteAskListResponseSchema,
	inviteAskRequestSchema,
	inviteAskResponseSchema,
	inviteCreateRequestSchema,
	inviteCreateResponseSchema,
	inviteListItemSchema,
	inviteListResponseSchema,
	inviteRevokeResponseSchema,
	inviteTokenSchema,
	loginOptionsRequestSchema,
	loginVerifyRequestSchema,
	logoutResponseSchema,
	meResponseSchema,
	okHandleResponseSchema,
	publicKeyOptionsResponseSchema,
	registerOptionsRequestSchema,
	registerVerifyRequestSchema,
	webAuthnAuthenticationResponseSchema,
	webAuthnRegistrationResponseSchema,
} from "./http";
export {
	formatPairingCode,
	mintPairingCode,
	normalizePairingCode,
	PAIRING_CODE_LENGTH,
} from "./pairing-code";
export {
	QUOTA_GRANT_MAX_MB,
	QUOTA_GRANT_MIN_MB,
	quotaBytesToMb,
	quotaGrantMbSchema,
	quotaMbToBytes,
	uploadCommitRequestSchema,
	uploadIntentRequestSchema,
	uploadRequestCreateSchema,
	uploadRequestDecideSchema,
	uploadTicketRequestSchema,
} from "./upload";
export type {
	ItemCreateRequest,
	ItemRecord,
	ItemUpdateRequest,
	PairingQr,
	PairingStartRequest,
	PairingWrapRequest,
	PublicJwk,
	PushSubscribeRequest,
	VaultPutRequest,
	WrappedKeyWire,
} from "./vault";
export {
	asPublicJwk,
	itemCreateRequestSchema,
	itemKindSchema,
	itemListResponseSchema,
	itemRecordSchema,
	itemUpdateRequestSchema,
	PAIRING_TTL_MS,
	pairingGetResponseSchema,
	pairingLookupRequestSchema,
	pairingQrSchema,
	pairingStartRequestSchema,
	pairingStartResponseSchema,
	pairingWrapRequestSchema,
	publicJwkSchema,
	pushSubscribeRequestSchema,
	TEXT_TTL_MS,
	vaultPutRequestSchema,
	vaultRecoveryRequestSchema,
	vaultRecoveryResponseSchema,
	wrappedKeyWireSchema,
} from "./vault";
export type { HubTicket, WsEnvelope } from "./ws";
export {
	AUTH_LIMIT_USER_ID,
	HUB_FANOUT_TTL_MS,
	HUB_LIMIT_TTL_MS,
	HUB_PING,
	HUB_PING_INTERVAL_MS,
	HUB_PONG,
	HUB_SILENCE_LIMIT_MS,
	HUB_WS_TTL_MS,
	mintHubTicket,
	openHubTicket,
	TEXT_CIPHERTEXT_MAX_BYTES,
	TEXT_PLAIN_MAX_BYTES,
	wsEnvelopeSchema,
} from "./ws";
