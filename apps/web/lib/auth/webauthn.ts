import type {
	AuthenticationResponseJSON,
	AuthenticatorTransportFuture,
	PublicKeyCredentialCreationOptionsJSON,
	PublicKeyCredentialRequestOptionsJSON,
	RegistrationResponseJSON,
} from "@simplewebauthn/server";
import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	verifyAuthenticationResponse,
	verifyRegistrationResponse,
} from "@simplewebauthn/server";

export type RegistrationVerification = {
	verified: boolean;
	registrationInfo?: {
		credential: {
			id: string;
			publicKey: Uint8Array;
			counter: number;
			transports?: string[];
		};
		credentialBackedUp?: boolean;
		aaguid?: string;
	};
};

export type AuthenticationVerification = {
	verified: boolean;
	authenticationInfo?: {
		newCounter: number;
	};
};

export type WebAuthnPort = {
	generateRegistrationOptions: (
		options: Parameters<typeof generateRegistrationOptions>[0],
	) => Promise<PublicKeyCredentialCreationOptionsJSON>;
	verifyRegistrationResponse: (
		options: Parameters<typeof verifyRegistrationResponse>[0],
	) => Promise<RegistrationVerification>;
	generateAuthenticationOptions: (
		options: Parameters<typeof generateAuthenticationOptions>[0],
	) => Promise<PublicKeyCredentialRequestOptionsJSON>;
	verifyAuthenticationResponse: (
		options: Parameters<typeof verifyAuthenticationResponse>[0],
	) => Promise<AuthenticationVerification>;
};

export const defaultWebAuthn: WebAuthnPort = {
	generateRegistrationOptions,
	verifyRegistrationResponse,
	generateAuthenticationOptions,
	verifyAuthenticationResponse,
};

const transportSet = new Set<AuthenticatorTransportFuture>([
	"ble",
	"hybrid",
	"internal",
	"nfc",
	"usb",
]);

export function toTransports(
	values: string[] | null | undefined,
): AuthenticatorTransportFuture[] | undefined {
	if (!values) {
		return undefined;
	}
	return values.filter((value): value is AuthenticatorTransportFuture =>
		transportSet.has(value as AuthenticatorTransportFuture),
	);
}

export function toRegistrationResponse(input: {
	id: string;
	rawId: string;
	response: {
		clientDataJSON: string;
		attestationObject: string;
		authenticatorData?: string;
		transports?: string[];
		publicKeyAlgorithm?: number;
		publicKey?: string;
	};
	clientExtensionResults?: Record<string, unknown>;
	authenticatorAttachment?: string;
}): RegistrationResponseJSON {
	return {
		id: input.id,
		rawId: input.rawId,
		type: "public-key",
		response: {
			clientDataJSON: input.response.clientDataJSON,
			attestationObject: input.response.attestationObject,
			authenticatorData: input.response.authenticatorData,
			publicKeyAlgorithm: input.response.publicKeyAlgorithm,
			publicKey: input.response.publicKey,
			transports: toTransports(input.response.transports),
		},
		clientExtensionResults: input.clientExtensionResults ?? {},
		authenticatorAttachment: attachment(input.authenticatorAttachment),
	};
}

export function toAuthenticationResponse(input: {
	id: string;
	rawId: string;
	response: {
		clientDataJSON: string;
		authenticatorData: string;
		signature: string;
		userHandle?: string | null;
	};
	clientExtensionResults?: Record<string, unknown>;
	authenticatorAttachment?: string;
}): AuthenticationResponseJSON {
	return {
		id: input.id,
		rawId: input.rawId,
		type: "public-key",
		response: {
			clientDataJSON: input.response.clientDataJSON,
			authenticatorData: input.response.authenticatorData,
			signature: input.response.signature,
			userHandle: input.response.userHandle ?? undefined,
		},
		clientExtensionResults: input.clientExtensionResults ?? {},
		authenticatorAttachment: attachment(input.authenticatorAttachment),
	};
}

function attachment(value: string | undefined): "platform" | "cross-platform" | undefined {
	if (value === "platform" || value === "cross-platform") {
		return value;
	}
	return undefined;
}

export type {
	AuthenticationResponseJSON,
	AuthenticatorTransportFuture,
	PublicKeyCredentialCreationOptionsJSON,
	PublicKeyCredentialRequestOptionsJSON,
	RegistrationResponseJSON,
};
