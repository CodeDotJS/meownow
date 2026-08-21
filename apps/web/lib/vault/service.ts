import { randomUUID, timingSafeEqual } from "node:crypto";
import type { WebEnv } from "@meownow/config/env";
import {
	fromBase64Url,
	nextSessionExpiry,
	randomToken,
	sha256,
	toBase64Url,
	uuidToBytes,
} from "@meownow/db";
import {
	HUB_WS_TTL_MS,
	type ItemCreateRequest,
	mintHubTicket,
	PAIRING_TTL_MS,
	type PairingWrapRequest,
	type PublicJwk,
	TEXT_CIPHERTEXT_MAX_BYTES,
	TEXT_TTL_MS,
	type VaultPutRequest,
} from "@meownow/protocol";
import { AuthError, type AuthStore, type SessionContext } from "../auth/store";
import type { RegistrationResponseJSON } from "../auth/webauthn";
import { defaultWebAuthn, type WebAuthnPort } from "../auth/webauthn";
import { type ChallengePayload, challengeExpiry, openChallenge, sealChallenge } from "../challenge";
import { rpFromAppUrl } from "../env";
import { type HubPort, silentHub } from "./hub";
import type { VaultStore } from "./store";

export type VaultServiceOptions = {
	env: WebEnv;
	auth: AuthStore;
	vault: VaultStore;
	hub?: HubPort;
	webauthn?: WebAuthnPort;
	now?: () => Date;
};

export class VaultService {
	private readonly env: WebEnv;
	private readonly auth: AuthStore;
	private readonly vault: VaultStore;
	private readonly hub: HubPort;
	private readonly webauthn: WebAuthnPort;
	private readonly now: () => Date;
	private readonly rp: { origin: string; rpID: string; rpName: string };

	constructor(opts: VaultServiceOptions) {
		this.env = opts.env;
		this.auth = opts.auth;
		this.vault = opts.vault;
		this.hub = opts.hub ?? silentHub();
		this.webauthn = opts.webauthn ?? defaultWebAuthn;
		this.now = opts.now ?? (() => new Date());
		this.rp = rpFromAppUrl(opts.env.APP_URL);
	}

	async putVault(sessionToken: string | undefined, body: VaultPutRequest): Promise<void> {
		const user = await this.requireUser(sessionToken);
		const result = await this.vault.saveVault(user.id, {
			identityPub: body.identityPub,
			wrappedVaultRecovery: body.wrappedVaultRecovery,
			recoverySalt: body.recoverySalt,
			recoveryVerifierHash: fromBase64Url(body.recoveryVerifier),
		});
		if (result === "vault_exists") {
			throw new AuthError("vault_exists", 409);
		}
	}

	async getRecovery(handle: string) {
		const found = await this.vault.getVaultByHandle(handle);
		if (!found) {
			throw new AuthError("vault_missing", 404);
		}
		return {
			recoverySalt: found.vault.recoverySalt,
			wrappedVaultRecovery: found.vault.wrappedVaultRecovery,
		};
	}

	async startPairing(publicJwk: PublicJwk) {
		const now = this.now();
		const id = randomUUID();
		await this.vault.createPairing({
			id,
			publicJwk,
			expiresAt: new Date(now.getTime() + PAIRING_TTL_MS),
			now,
		});
		return { id, expiresAt: new Date(now.getTime() + PAIRING_TTL_MS).toISOString() };
	}

	async getPairing(id: string) {
		const row = await this.requireLivePairing(id);
		const handle = row.userId ? ((await this.auth.getUserById(row.userId))?.handle ?? null) : null;
		return {
			id: row.id,
			expiresAt: row.expiresAt.toISOString(),
			publicJwk: row.publicJwk,
			handle,
			wrap: row.wrap,
		};
	}

	async postWrap(sessionToken: string | undefined, id: string, wrap: PairingWrapRequest) {
		const user = await this.requireUser(sessionToken);
		const row = await this.requireLivePairing(id);
		if (row.wrap) {
			throw new AuthError("pairing_complete", 409);
		}
		const result = await this.vault.savePairingWrap({ id, userId: user.id, wrap, now: this.now() });
		if (result === "missing") {
			throw new AuthError("pairing_missing", 404);
		}
		if (result === "complete") {
			throw new AuthError("pairing_complete", 409);
		}
	}

	async createItem(sessionToken: string | undefined, item: ItemCreateRequest) {
		const user = await this.requireUser(sessionToken);
		if (!user.hasVault) {
			throw new AuthError("vault_missing", 409);
		}
		const now = this.now();
		this.assertLiveItem(item, now);
		await this.vault.createItem(user.id, item, now);
		const record = { ...item, createdAt: now.toISOString() };
		await this.hub.publish(user.id, { v: 1, type: "item.created", item: record });
		return record;
	}

	async listItems(sessionToken: string | undefined) {
		const user = await this.requireUser(sessionToken);
		const now = this.now().getTime();
		const rows = await this.vault.listItems(user.id);
		return {
			items: rows
				.filter((item) => Date.parse(item.expiresAt) > now)
				.map(({ ownerId: _ownerId, ...item }) => ({
					...item,
					createdAt: item.createdAt.toISOString(),
				})),
		};
	}

	async deleteItem(sessionToken: string | undefined, id: string) {
		const user = await this.requireUser(sessionToken);
		const ok = await this.vault.deleteItem(user.id, id);
		if (!ok) {
			throw new AuthError("item_invalid", 404);
		}
		await this.hub.publish(user.id, { v: 1, type: "item.deleted", id });
	}

	async hubTicket(sessionToken: string | undefined) {
		if (!this.env.HUB_SECRET || !this.env.EDGE_URL) {
			throw new AuthError("hub_unconfigured", 503);
		}
		const ctx = await this.requireCtx(sessionToken);
		const ticket = await mintHubTicket(this.env.HUB_SECRET, {
			v: 1,
			purpose: "ws",
			userId: ctx.user.id,
			deviceId: ctx.device.id,
			exp: this.now().getTime() + HUB_WS_TTL_MS,
		});
		return { ticket, url: `${this.env.EDGE_URL.replace(/\/$/, "")}/ws` };
	}

	async pairingRegisterOptions(pairingId: string, deviceLabel: string) {
		const row = await this.requireLivePairing(pairingId);
		if (!row.userId || !row.wrap) {
			throw new AuthError("pairing_missing", 400);
		}
		const user = await this.auth.getUserById(row.userId);
		if (!user) {
			throw new AuthError("pairing_missing", 400);
		}
		const now = this.now();
		const options = await this.webauthn.generateRegistrationOptions({
			rpName: this.rp.rpName,
			rpID: this.rp.rpID,
			userName: user.handle,
			userDisplayName: user.displayName,
			userID: Uint8Array.from(uuidToBytes(user.id)),
			attestationType: "none",
			authenticatorSelection: { residentKey: "required", userVerification: "required" },
		});
		const challenge = sealChallenge(
			{
				v: 1,
				purpose: "pairing_enroll",
				challenge: options.challenge,
				exp: challengeExpiry(now),
				userId: user.id,
				handle: user.handle,
				deviceLabel,
				pairingId,
			},
			this.env.SESSION_SECRET,
		);
		return { options, challenge };
	}

	async pairingRegisterVerify(credential: RegistrationResponseJSON, sealed: string | undefined) {
		const payload = this.requireChallenge(sealed, "pairing_enroll");
		if (!payload.userId || !payload.handle || !payload.deviceLabel || !payload.pairingId) {
			throw new AuthError("invalid_challenge", 400);
		}
		await this.requireLivePairing(payload.pairingId);
		return this.finishDeviceEnroll(credential, payload);
	}

	async recoveryRegisterOptions(input: { handle: string; verifier: string; deviceLabel: string }) {
		const found = await this.vault.getVaultByHandle(input.handle);
		if (!found) {
			throw new AuthError("vault_missing", 404);
		}
		const given = fromBase64Url(input.verifier);
		const expected = found.vault.recoveryVerifierHash;
		if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
			throw new AuthError("recovery_invalid", 403);
		}
		const user = await this.auth.getUserById(found.userId);
		if (!user) {
			throw new AuthError("vault_missing", 404);
		}
		const now = this.now();
		const options = await this.webauthn.generateRegistrationOptions({
			rpName: this.rp.rpName,
			rpID: this.rp.rpID,
			userName: user.handle,
			userDisplayName: user.displayName,
			userID: Uint8Array.from(uuidToBytes(user.id)),
			attestationType: "none",
			authenticatorSelection: { residentKey: "required", userVerification: "required" },
		});
		const challenge = sealChallenge(
			{
				v: 1,
				purpose: "recovery_enroll",
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

	async recoveryRegisterVerify(credential: RegistrationResponseJSON, sealed: string | undefined) {
		const payload = this.requireChallenge(sealed, "recovery_enroll");
		if (!payload.userId || !payload.handle || !payload.deviceLabel) {
			throw new AuthError("invalid_challenge", 400);
		}
		return this.finishDeviceEnroll(credential, payload);
	}

	private async finishDeviceEnroll(
		credential: RegistrationResponseJSON,
		payload: ChallengePayload,
	) {
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
		const expiry = nextSessionExpiry(now, now);
		if (!expiry) {
			throw new AuthError("unauthorized", 401);
		}
		const info = verification.registrationInfo;
		await this.vault.addDeviceAndSession({
			userId: payload.userId,
			now,
			device: {
				id: randomUUID(),
				label: payload.deviceLabel,
				credentialId: fromBase64Url(info.credential.id),
				publicKey: Buffer.from(info.credential.publicKey),
				signCount: info.credential.counter,
				transports: info.credential.transports ?? null,
				aaguid: null,
				backedUp: info.credentialBackedUp ?? null,
			},
			session: {
				tokenHash: sha256(fromBase64Url(sessionToken)),
				expiresAt: expiry,
			},
		});
		if (payload.pairingId) {
			await this.vault.deletePairing(payload.pairingId);
		}
		return { handle: payload.handle, sessionToken };
	}

	private async requireLivePairing(id: string) {
		const row = await this.vault.getPairing(id);
		if (!row) {
			throw new AuthError("pairing_missing", 404);
		}
		if (row.expiresAt.getTime() <= this.now().getTime()) {
			throw new AuthError("pairing_expired", 400);
		}
		return row;
	}

	private async requireUser(sessionToken: string | undefined) {
		return (await this.requireCtx(sessionToken)).user;
	}

	private async requireCtx(sessionToken: string | undefined): Promise<SessionContext> {
		if (!sessionToken) {
			throw new AuthError("unauthorized", 401);
		}
		const ctx = await this.auth.getSessionByTokenHash(sha256(fromBase64Url(sessionToken)));
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

	private assertLiveItem(item: ItemCreateRequest, now: Date): void {
		const cipher = fromBase64Url(item.ciphertext);
		if (cipher.byteLength > TEXT_CIPHERTEXT_MAX_BYTES) {
			throw new AuthError("item_invalid", 400);
		}
		const expiresAt = Date.parse(item.expiresAt);
		if (Number.isNaN(expiresAt) || expiresAt <= now.getTime()) {
			throw new AuthError("item_expired", 400);
		}
		if (expiresAt > now.getTime() + TEXT_TTL_MS + 60_000) {
			throw new AuthError("item_invalid", 400);
		}
	}

	private requireChallenge(sealed: string | undefined, purpose: ChallengePayload["purpose"]) {
		if (!sealed) {
			throw new AuthError("invalid_challenge", 400);
		}
		const payload = openChallenge(sealed, this.env.SESSION_SECRET, this.now());
		if (!payload || payload.purpose !== purpose) {
			throw new AuthError("invalid_challenge", 400);
		}
		return payload;
	}
}
