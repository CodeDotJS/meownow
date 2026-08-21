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
	VaultPutRequest,
	WrappedKeyWire,
} from "./vault";
export {
	asPublicJwk,
	itemCreateRequestSchema,
	itemListResponseSchema,
	PAIRING_TTL_MS,
	pairingGetResponseSchema,
	pairingQrSchema,
	pairingStartRequestSchema,
	pairingWrapRequestSchema,
	publicJwkSchema,
	TEXT_TTL_MS,
	vaultPutRequestSchema,
	vaultRecoveryRequestSchema,
	vaultRecoveryResponseSchema,
	wrappedKeyWireSchema,
} from "./vault";
