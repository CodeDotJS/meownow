import { randomUUID } from "node:crypto";
import type { WebEnv } from "@meownow/config/env";
import {
	fromBase64Url,
	inviteExpiresAt,
	inviteState,
	nextSessionExpiry,
	randomToken,
	sha256,
	toBase64Url,
	uuidToBytes,
} from "@meownow/db";
import type {
	AdminEnrollOptionsRequest,
	ErrorCode,
	InviteCreateResponse,
	MeResponse,
	RegisterOptionsRequest,
} from "@meownow/protocol";
import { type ChallengePayload, challengeExpiry, openChallenge, sealChallenge } from "../challenge";
import { rpFromAppUrl } from "../env";
import { AuthError, type AuthStore, type SessionContext, type UserRow } from "./store";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "./webauthn";
import { defaultWebAuthn, toTransports, type WebAuthnPort } from "./webauthn";

export type AuthServiceOptions = {
	env: WebEnv;
	store: AuthStore;
	webauthn?: WebAuthnPort;
	now?: () => Date;
};

export class AuthService {
	private readonly env: WebEnv;
	private readonly store: AuthStore;
	private readonly webauthn: WebAuthnPort;
	private readonly now: () => Date;
	private readonly rp: { origin: string; rpID: string; rpName: string };

	constructor(opts: AuthServiceOptions) {
		this.env = opts.env;
		this.store = opts.store;
		this.webauthn = opts.webauthn ?? defaultWebAuthn;
		this.now = opts.now ?? (() => new Date());
		this.rp = rpFromAppUrl(opts.env.APP_URL);
	}

	async createInvite(
		sessionToken: string | undefined,
		note: string | undefined,
	): Promise<InviteCreateResponse> {
		const admin = await this.requireAdmin(sessionToken);
		const now = this.now();
		const token = randomToken(32);
		const inserted = await this.store.createInvite({
			createdBy: admin.id,
			note: note ?? null,
			tokenHash: sha256(token),
			expiresAt: inviteExpiresAt(now),
			now,
		});
		await this.store.insertAudit({
			actorId: admin.id,
			action: "invite.issued",
			subjectType: "invite",
			subjectId: inserted.id,
			now,
		});
		return {
			id: inserted.id,
			token: toBase64Url(token),
			expiresAt: inviteExpiresAt(now).toISOString(),
		};
	}

	async revokeInvite(sessionToken: string | undefined, inviteId: string): Promise<void> {
		const admin = await this.requireAdmin(sessionToken);
		const now = this.now();
		const ok = await this.store.revokeInvite(inviteId, now);
		if (!ok) {
			throw new AuthError("invite_invalid", 400);
		}
		await this.store.insertAudit({
			actorId: admin.id,
			action: "invite.revoked",
			subjectType: "invite",
			subjectId: inviteId,
			now,
		});
	}

	async listInvites(sessionToken: string | undefined) {
		await this.requireAdmin(sessionToken);
		const rows = await this.store.listInvites();
		return {
			invites: rows.map((row) => ({
				id: row.id,
				note: row.note,
				expiresAt: row.expiresAt.toISOString(),
				redeemedAt: row.redeemedAt?.toISOString() ?? null,
				revokedAt: row.revokedAt?.toISOString() ?? null,
				createdAt: row.createdAt.toISOString(),
			})),
		};
	}

	async registerOptions(
		input: RegisterOptionsRequest,
	): Promise<{ options: unknown; challenge: string }> {
		const now = this.now();
		const invite = await this.store.getInviteByTokenHash(sha256(fromBase64Url(input.token)));
		this.throwInvite(inviteState(invite, now));
		if (await this.store.handleTaken(input.handle)) {
			throw new AuthError("handle_taken", 409);
		}
		const userId = randomUUID();
		const options = await this.webauthn.generateRegistrationOptions({
			rpName: this.rp.rpName,
			rpID: this.rp.rpID,
			userName: input.handle,
			userDisplayName: input.displayName,
			userID: Uint8Array.from(uuidToBytes(userId)),
			attestationType: "none",
			authenticatorSelection: {
				residentKey: "required",
				userVerification: "required",
			},
		});
		const challenge = sealChallenge(
			{
				v: 1,
				purpose: "register",
				challenge: options.challenge,
				exp: challengeExpiry(now),
				userId,
				handle: input.handle,
				displayName: input.displayName,
				deviceLabel: input.deviceLabel,
				inviteTokenHash: toBase64Url(sha256(fromBase64Url(input.token))),
			},
			this.env.SESSION_SECRET,
		);
		return { options, challenge };
	}

	async registerVerify(
		credential: RegistrationResponseJSON,
		sealed: string | undefined,
	): Promise<{ handle: string; sessionToken: string }> {
		const payload = this.requireChallenge(sealed, "register");
		if (
			!payload.userId ||
			!payload.handle ||
			!payload.displayName ||
			!payload.deviceLabel ||
			!payload.inviteTokenHash
		) {
			throw new AuthError("invalid_challenge", 400);
		}
		const verification = await this.webauthn.verifyRegistrationResponse({
			response: credential,
			expectedChallenge: payload.challenge,
			expectedOrigin: this.rp.origin,
			expectedRPID: this.rp.rpID,
			requireUserVerification: true,
		});
		if (!verification.verified || !verification.registrationInfo) {
			throw new AuthError("unverified", 401);
		}
		const now = this.now();
		const sessionToken = toBase64Url(randomToken(32));
		const device = deviceFromRegistration(payload.deviceLabel, verification.registrationInfo);
		const result = await this.store.completeRegistration({
			userId: payload.userId,
			handle: payload.handle,
			displayName: payload.displayName,
			inviteTokenHash: fromBase64Url(payload.inviteTokenHash),
			now,
			device,
			session: {
				tokenHash: sha256(fromBase64Url(sessionToken)),
				expiresAt: requireExpiry(now, now),
			},
		});
		if (result === "seats_full") {
			throw new AuthError("seats_full", 409);
		}
		if (result === "handle_taken") {
			throw new AuthError("handle_taken", 409);
		}
		if (result === "invite_invalid") {
			throw new AuthError("invite_invalid", 400);
		}
		await this.store.insertAudit({
			actorId: payload.userId,
			action: "invite.redeemed",
			subjectType: "user",
			subjectId: payload.userId,
			now,
		});
		return { handle: payload.handle, sessionToken };
	}

	async adminEnrollOptions(
		input: AdminEnrollOptionsRequest,
	): Promise<{ options: unknown; challenge: string }> {
		if (input.secret !== this.env.ADMIN_ENROLL_SECRET) {
			throw new AuthError("forbidden", 403);
		}
		const user = await this.store.getUserByHandle(input.handle);
		if (user?.role !== "admin") {
			throw new AuthError("forbidden", 403);
		}
		if ((await this.store.countDevices(user.id)) > 0) {
			throw new AuthError("admin_enrolled", 409);
		}
		const now = this.now();
		const options = await this.webauthn.generateRegistrationOptions({
			rpName: this.rp.rpName,
			rpID: this.rp.rpID,
			userName: user.handle,
			userDisplayName: user.displayName,
			userID: Uint8Array.from(uuidToBytes(user.id)),
			attestationType: "none",
			authenticatorSelection: {
				residentKey: "required",
				userVerification: "required",
			},
		});
		const challenge = sealChallenge(
			{
				v: 1,
				purpose: "admin_enroll",
				challenge: options.challenge,
				exp: challengeExpiry(now),
				userId: user.id,
				handle: user.handle,
				deviceLabel: input.deviceLabel,
			},
			this.env.SESSION_SECRET,
		);
		return { options, challenge };
	}

	async adminEnrollVerify(
		credential: RegistrationResponseJSON,
		sealed: string | undefined,
	): Promise<{ handle: string; sessionToken: string }> {
		const payload = this.requireChallenge(sealed, "admin_enroll");
		if (!payload.userId || !payload.handle || !payload.deviceLabel) {
			throw new AuthError("invalid_challenge", 400);
		}
		const verification = await this.webauthn.verifyRegistrationResponse({
			response: credential,
			expectedChallenge: payload.challenge,
			expectedOrigin: this.rp.origin,
			expectedRPID: this.rp.rpID,
			requireUserVerification: true,
		});
		if (!verification.verified || !verification.registrationInfo) {
			throw new AuthError("unverified", 401);
		}
		const now = this.now();
		const sessionToken = toBase64Url(randomToken(32));
		const result = await this.store.completeAdminEnroll({
			userId: payload.userId,
			now,
			device: deviceFromRegistration(payload.deviceLabel, verification.registrationInfo),
			session: {
				tokenHash: sha256(fromBase64Url(sessionToken)),
				expiresAt: requireExpiry(now, now),
			},
		});
		if (result === "admin_enrolled") {
			throw new AuthError("admin_enrolled", 409);
		}
		await this.store.insertAudit({
			actorId: payload.userId,
			action: "auth.admin_enroll",
			subjectType: "user",
			subjectId: payload.userId,
			now,
		});
		return { handle: payload.handle, sessionToken };
	}

	async loginOptions(): Promise<{ options: unknown; challenge: string }> {
		const now = this.now();
		const options = await this.webauthn.generateAuthenticationOptions({
			rpID: this.rp.rpID,
			userVerification: "required",
		});
		const challenge = sealChallenge(
			{
				v: 1,
				purpose: "login",
				challenge: options.challenge,
				exp: challengeExpiry(now),
			},
			this.env.SESSION_SECRET,
		);
		return { options, challenge };
	}

	async loginVerify(
		credential: AuthenticationResponseJSON,
		sealed: string | undefined,
	): Promise<{ handle: string; sessionToken: string }> {
		const payload = this.requireChallenge(sealed, "login");
		const device = await this.store.getDeviceByCredentialId(fromBase64Url(credential.id));
		if (!device) {
			throw new AuthError("unauthorized", 401);
		}
		if (device.revokedAt) {
			throw new AuthError("device_revoked", 403);
		}
		if (device.user.suspendedAt) {
			throw new AuthError("suspended", 403);
		}
		const verification = await this.webauthn.verifyAuthenticationResponse({
			response: credential,
			expectedChallenge: payload.challenge,
			expectedOrigin: this.rp.origin,
			expectedRPID: this.rp.rpID,
			requireUserVerification: true,
			credential: {
				id: toBase64Url(device.credentialId),
				publicKey: new Uint8Array(device.publicKey),
				counter: device.signCount,
				transports: toTransports(device.transports),
			},
		});
		if (!verification.verified || !verification.authenticationInfo) {
			throw new AuthError("unverified", 401);
		}
		const now = this.now();
		const sessionToken = toBase64Url(randomToken(32));
		await this.store.completeLogin({
			deviceId: device.id,
			signCount: verification.authenticationInfo.newCounter,
			now,
			session: {
				tokenHash: sha256(fromBase64Url(sessionToken)),
				expiresAt: requireExpiry(now, now),
			},
		});
		await this.store.insertAudit({
			actorId: device.user.id,
			action: "auth.login",
			subjectType: "device",
			subjectId: device.id,
			now,
		});
		return { handle: device.user.handle, sessionToken };
	}

	async logout(sessionToken: string | undefined): Promise<void> {
		if (!sessionToken) {
			return;
		}
		await this.store.deleteSession(sha256(fromBase64Url(sessionToken)));
	}

	async me(
		sessionToken: string | undefined,
	): Promise<{ profile: MeResponse; sessionToken: string }> {
		const ctx = await this.requireSession(sessionToken);
		const now = this.now();
		const expiresAt = nextSessionExpiry(ctx.session.createdAt, now);
		if (!expiresAt) {
			await this.store.deleteSession(ctx.session.tokenHash);
			throw new AuthError("unauthorized", 401);
		}
		await this.store.touchSession(ctx.session.tokenHash, expiresAt, now);
		return {
			profile: {
				handle: ctx.user.handle,
				displayName: ctx.user.displayName,
				role: ctx.user.role,
				canUpload: ctx.user.canUpload,
			},
			sessionToken: sessionToken ?? "",
		};
	}

	private async requireSession(sessionToken: string | undefined): Promise<SessionContext> {
		if (!sessionToken) {
			throw new AuthError("unauthorized", 401);
		}
		const ctx = await this.store.getSessionByTokenHash(sha256(fromBase64Url(sessionToken)));
		const now = this.now();
		if (!ctx || ctx.session.expiresAt.getTime() <= now.getTime()) {
			throw new AuthError("unauthorized", 401);
		}
		if (ctx.device.revokedAt) {
			throw new AuthError("device_revoked", 403);
		}
		if (ctx.user.suspendedAt) {
			throw new AuthError("suspended", 403);
		}
		return ctx;
	}

	private async requireAdmin(sessionToken: string | undefined): Promise<UserRow> {
		const ctx = await this.requireSession(sessionToken);
		if (ctx.user.role !== "admin") {
			throw new AuthError("forbidden", 403);
		}
		return ctx.user;
	}

	private requireChallenge(
		sealed: string | undefined,
		purpose: ChallengePayload["purpose"],
	): ChallengePayload {
		if (!sealed) {
			throw new AuthError("invalid_challenge", 400);
		}
		const payload = openChallenge(sealed, this.env.SESSION_SECRET, this.now());
		if (!payload || payload.purpose !== purpose) {
			throw new AuthError("invalid_challenge", 400);
		}
		return payload;
	}

	private throwInvite(state: ReturnType<typeof inviteState>): void {
		const map: Record<Exclude<typeof state, "ok">, { code: ErrorCode; status: number }> = {
			missing: { code: "invite_invalid", status: 400 },
			expired: { code: "invite_expired", status: 400 },
			revoked: { code: "invite_revoked", status: 400 },
			redeemed: { code: "invite_redeemed", status: 400 },
		};
		if (state === "ok") {
			return;
		}
		const mapped = map[state];
		if (!mapped) {
			throw new AuthError("invite_invalid", 400);
		}
		throw new AuthError(mapped.code, mapped.status);
	}
}

function requireExpiry(createdAt: Date, now: Date): Date {
	const expiry = nextSessionExpiry(createdAt, now);
	if (!expiry) {
		throw new AuthError("unauthorized", 401);
	}
	return expiry;
}

function deviceFromRegistration(
	label: string,
	info: {
		credential: { id: string; publicKey: Uint8Array; counter: number; transports?: string[] };
		credentialBackedUp?: boolean;
		aaguid?: string;
	},
) {
	return {
		id: randomUUID(),
		label,
		credentialId: fromBase64Url(info.credential.id),
		publicKey: Buffer.from(info.credential.publicKey),
		signCount: info.credential.counter,
		transports: info.credential.transports ?? null,
		aaguid: parseAaguid(info.aaguid),
		backedUp: info.credentialBackedUp ?? null,
	};
}

function parseAaguid(value: string | undefined): string | null {
	if (!value || value === "00000000-0000-0000-0000-000000000000") {
		return null;
	}
	if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
		return null;
	}
	return value.toLowerCase();
}
