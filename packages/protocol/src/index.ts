import { z } from "zod";

export const protocolVersionSchema = z.literal(1);

export type ProtocolVersion = z.infer<typeof protocolVersionSchema>;

export type {
	AdminEnrollOptionsRequest,
	ErrorCode,
	ErrorEnvelope,
	InviteCreateRequest,
	InviteCreateResponse,
	LoginVerifyRequest,
	MeResponse,
	RegisterOptionsRequest,
	RegisterVerifyRequest,
} from "./http";
export {
	adminEnrollOptionsRequestSchema,
	deviceLabelSchema,
	displayNameSchema,
	errorCodeSchema,
	errorEnvelopeSchema,
	handleSchema,
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
export type {
	ItemCreateRequest,
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
	itemListResponseSchema,
	itemRecordSchema,
	PAIRING_TTL_MS,
	pairingGetResponseSchema,
	pairingQrSchema,
	pairingStartRequestSchema,
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
	HUB_FANOUT_TTL_MS,
	HUB_WS_TTL_MS,
	mintHubTicket,
	openHubTicket,
	TEXT_CIPHERTEXT_MAX_BYTES,
	TEXT_PLAIN_MAX_BYTES,
	wsEnvelopeSchema,
} from "./ws";
