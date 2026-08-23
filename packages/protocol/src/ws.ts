import { z } from "zod";
import { itemRecordSchema } from "./vault";

export const TEXT_PLAIN_MAX_BYTES = 64 * 1024;
export const TEXT_CIPHERTEXT_MAX_BYTES = TEXT_PLAIN_MAX_BYTES + 16;
export const HUB_WS_TTL_MS = 60 * 1000;
export const HUB_FANOUT_TTL_MS = 30 * 1000;
export const HUB_LIMIT_TTL_MS = 30 * 1000;
export const AUTH_LIMIT_USER_ID = "00000000-0000-4000-8000-00000000000a";

/**
 * Cloudflare matches auto-responses by exact string, so these are the literal
 * frames rather than something re-serialised at the call site.
 */
export const HUB_PING = '{"v":1,"type":"ping"}';
export const HUB_PONG = '{"v":1,"type":"pong"}';
/** Silence longer than this means the socket is dead, even if onclose never fired. */
export const HUB_PING_INTERVAL_MS = 25 * 1000;
export const HUB_SILENCE_LIMIT_MS = 70 * 1000;

export const hubTicketSchema = z.object({
	v: z.literal(1),
	purpose: z.enum(["ws", "fanout", "limit", "cron"]),
	userId: z.string().uuid(),
	deviceId: z.string().uuid().optional(),
	exp: z.number().int(),
});

export const wsEnvelopeSchema = z.discriminatedUnion("type", [
	z.object({
		v: z.literal(1),
		type: z.literal("item.created"),
		item: itemRecordSchema,
		ephemeral: z.boolean().optional(),
	}),
	z.object({
		v: z.literal(1),
		type: z.literal("item.deleted"),
		id: z.string().uuid(),
	}),
	z.object({
		v: z.literal(1),
		type: z.literal("device.revoked"),
		id: z.string().uuid(),
	}),
	z.object({
		v: z.literal(1),
		type: z.literal("hello"),
		deviceId: z.string().uuid(),
	}),
	z.object({
		v: z.literal(1),
		type: z.literal("ping"),
	}),
	z.object({
		v: z.literal(1),
		type: z.literal("pong"),
	}),
	z.object({
		v: z.literal(1),
		type: z.literal("presence.changed"),
		devices: z.array(z.string().uuid()),
	}),
	z.object({
		v: z.literal(1),
		type: z.literal("rtc.offer"),
		from: z.string().uuid(),
		to: z.string().uuid(),
		sdp: z.string().min(1),
	}),
	z.object({
		v: z.literal(1),
		type: z.literal("rtc.answer"),
		from: z.string().uuid(),
		to: z.string().uuid(),
		sdp: z.string().min(1),
	}),
	z.object({
		v: z.literal(1),
		type: z.literal("rtc.ice"),
		from: z.string().uuid(),
		to: z.string().uuid(),
		candidate: z.string(),
		sdpMid: z.string().nullable(),
		sdpMLineIndex: z.number().int().nullable(),
	}),
]);

export type HubTicket = z.infer<typeof hubTicketSchema>;
export type WsEnvelope = z.infer<typeof wsEnvelopeSchema>;

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

async function hmacKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign", "verify"],
	);
}

export async function mintHubTicket(secret: string, ticket: HubTicket): Promise<string> {
	const payload = toB64url(new TextEncoder().encode(JSON.stringify(ticket)));
	const key = await hmacKey(secret);
	const sig = new Uint8Array(
		await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)),
	);
	return `${payload}.${toB64url(sig)}`;
}

export async function openHubTicket(
	secret: string,
	token: string,
	now: Date = new Date(),
): Promise<HubTicket | null> {
	const parts = token.split(".");
	if (parts.length !== 2 || !parts[0] || !parts[1]) {
		return null;
	}
	const payload = parts[0];
	const given = fromB64url(parts[1]);
	const key = await hmacKey(secret);
	const expected = new Uint8Array(
		await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)),
	);
	if (given.length !== expected.length) {
		return null;
	}
	let diff = 0;
	for (let i = 0; i < given.length; i += 1) {
		diff |= (given[i] ?? 0) ^ (expected[i] ?? 0);
	}
	if (diff !== 0) {
		return null;
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
	} catch {
		return null;
	}
	const ticket = hubTicketSchema.safeParse(parsed);
	if (!ticket.success || ticket.data.exp <= now.getTime()) {
		return null;
	}
	return ticket.data;
}
