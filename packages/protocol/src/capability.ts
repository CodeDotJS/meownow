import { z } from "zod";

export const FILE_MAX_BYTES = 100 * 1024 * 1024;
export const BLOB_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const PENDING_BLOB_MAX_AGE_MS = 60 * 60 * 1000;
export const CAPABILITY_TTL_MS = 60 * 1000;
export const MAX_CHUNK_CIPHER_BYTES = 1_048_576 + 16;

export const capabilityTokenSchema = z.object({
	v: z.literal(1),
	purpose: z.enum(["upload", "stat", "download"]),
	userId: z.string().uuid(),
	key: z.string().uuid(),
	maxBytes: z.number().int().positive(),
	blobId: z.string().uuid(),
	exp: z.number().int(),
});

export type CapabilityToken = z.infer<typeof capabilityTokenSchema>;
export type CapabilityJwk = JsonWebKey;

const encoder = new TextEncoder();

export async function generateCapabilityKeyPair(): Promise<{
	publicJwk: JsonWebKey;
	privateJwk: JsonWebKey;
}> {
	const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
	if (!("publicKey" in pair) || !("privateKey" in pair)) {
		throw new Error("expected_key_pair");
	}
	const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
	const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
	if (!isJwk(publicJwk) || !isJwk(privateJwk)) {
		throw new Error("expected_jwk");
	}
	return { publicJwk, privateJwk };
}

function isJwk(value: ArrayBuffer | JsonWebKey): value is JsonWebKey {
	return typeof value === "object" && value !== null && "kty" in value;
}

export function parseCapabilityJwk(raw: string): JsonWebKey {
	const parsed: unknown = JSON.parse(raw);
	if (!parsed || typeof parsed !== "object") {
		throw new Error("invalid_jwk");
	}
	return parsed as JsonWebKey;
}

export async function mintCapabilityToken(
	privateJwk: JsonWebKey,
	token: CapabilityToken,
): Promise<string> {
	const key = await crypto.subtle.importKey("jwk", privateJwk, { name: "Ed25519" }, false, [
		"sign",
	]);
	const header = toB64url(encoder.encode(JSON.stringify({ alg: "EdDSA", typ: "JWT" })));
	const payload = toB64url(encoder.encode(JSON.stringify(token)));
	const input = `${header}.${payload}`;
	const sig = new Uint8Array(
		await crypto.subtle.sign({ name: "Ed25519" }, key, encoder.encode(input)),
	);
	return `${input}.${toB64url(sig)}`;
}

export async function openCapabilityToken(
	publicJwk: JsonWebKey,
	jwt: string,
	now: Date = new Date(),
): Promise<CapabilityToken | null> {
	const parts = jwt.split(".");
	if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
		return null;
	}
	const input = `${parts[0]}.${parts[1]}`;
	let sig: Uint8Array;
	let payloadBytes: Uint8Array;
	try {
		sig = fromB64url(parts[2]);
		payloadBytes = fromB64url(parts[1]);
	} catch {
		return null;
	}
	const key = await crypto.subtle.importKey("jwk", publicJwk, { name: "Ed25519" }, false, [
		"verify",
	]);
	const ok = await crypto.subtle.verify(
		{ name: "Ed25519" },
		key,
		toArrayBuffer(sig),
		encoder.encode(input),
	);
	if (!ok) {
		return null;
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(new TextDecoder().decode(payloadBytes));
	} catch {
		return null;
	}
	const token = capabilityTokenSchema.safeParse(parsed);
	if (!token.success) {
		return null;
	}
	if (token.data.exp * 1000 <= now.getTime()) {
		return null;
	}
	return token.data;
}

function toB64url(bytes: Uint8Array): string {
	let bin = "";
	for (const byte of bytes) {
		bin += String.fromCharCode(byte);
	}
	return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromB64url(value: string): Uint8Array {
	const padded = value.replaceAll("-", "+").replaceAll("_", "/");
	const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
	const bin = atob(padded + pad);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i += 1) {
		out[i] = bin.charCodeAt(i);
	}
	return out;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	return copy.buffer;
}
