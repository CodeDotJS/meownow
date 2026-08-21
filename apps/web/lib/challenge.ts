import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export const challengePayloadSchema = z.object({
	v: z.literal(1),
	purpose: z.enum(["register", "login", "admin_enroll"]),
	challenge: z.string().min(1),
	exp: z.number(),
	userId: z.string().uuid().optional(),
	handle: z.string().optional(),
	displayName: z.string().optional(),
	deviceLabel: z.string().optional(),
	inviteTokenHash: z.string().optional(),
});

export type ChallengePayload = z.infer<typeof challengePayloadSchema>;

export function sealChallenge(payload: ChallengePayload, secret: string): string {
	const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
	const mac = createHmac("sha256", secret).update(body).digest("base64url");
	return `${body}.${mac}`;
}

export function openChallenge(sealed: string, secret: string, now: Date): ChallengePayload | null {
	const dot = sealed.lastIndexOf(".");
	if (dot <= 0) {
		return null;
	}
	const body = sealed.slice(0, dot);
	const mac = sealed.slice(dot + 1);
	const expected = createHmac("sha256", secret).update(body).digest();
	let given: Buffer;
	try {
		given = Buffer.from(mac, "base64url");
	} catch {
		return null;
	}
	if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
		return null;
	}
	let raw: unknown;
	try {
		raw = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
	} catch {
		return null;
	}
	const parsed = challengePayloadSchema.safeParse(raw);
	if (!parsed.success) {
		return null;
	}
	if (parsed.data.exp <= now.getTime()) {
		return null;
	}
	return parsed.data;
}

export function challengeExpiry(now: Date): number {
	return now.getTime() + CHALLENGE_TTL_MS;
}
