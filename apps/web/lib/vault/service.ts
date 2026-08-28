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
	BLOB_TTL_MS,
	CAPABILITY_TTL_MS,
	FILE_MAX_BYTES,
	HUB_WS_TTL_MS,
	type ItemCreateRequest,
	type ItemUpdateRequest,
	mintHubTicket,
	mintPairingCode,
	PAIRING_TTL_MS,
	type PairingWrapRequest,
	type PublicJwk,
	quotaGrantMbSchema,
	quotaMbToBytes,
	R2_CLASS_A_CEILING,
	R2_CLASS_B_CEILING,
	R2_STORAGE_CEILING_BYTES,
	SEAT_CEILING,
	TEXT_CIPHERTEXT_MAX_BYTES,
	TEXT_TTL_MS,
	type VaultPutRequest,
} from "@meownow/protocol";
import { AuthError, type AuthStore, type SessionContext } from "../auth/store";
import type { RegistrationResponseJSON } from "../auth/webauthn";
import { defaultWebAuthn, type WebAuthnPort } from "../auth/webauthn";
import { type ChallengePayload, challengeExpiry, openChallenge, sealChallenge } from "../challenge";
import { rpFromAppUrl } from "../env";
import { type BlobPort, signCapability, silentBlobs } from "./blobs";
import { type HubPort, hubOrigin, silentHub } from "./hub";
import { type LimitPort, silentLimits } from "./limits";
import { type PushPort, silentPush } from "./push";
import type { VaultStore } from "./store";

export type VaultServiceOptions = {
	env: WebEnv;
	auth: AuthStore;
	vault: VaultStore;
	hub?: HubPort;
	push?: PushPort;
	blobs?: BlobPort;
	limits?: LimitPort;
	webauthn?: WebAuthnPort;
	now?: () => Date;
};

export class VaultService {
	private readonly env: WebEnv;
	private readonly auth: AuthStore;
	private readonly vault: VaultStore;
	private readonly hub: HubPort;
	private readonly push: PushPort;
	private readonly blobs: BlobPort;
	private readonly limits: LimitPort;
	private readonly webauthn: WebAuthnPort;
	private readonly now: () => Date;
	private readonly rp: { origin: string; rpID: string; rpName: string };

	constructor(opts: VaultServiceOptions) {
		this.env = opts.env;
		this.auth = opts.auth;
		this.vault = opts.vault;
		this.hub = opts.hub ?? silentHub();
		this.push = opts.push ?? silentPush();
		this.blobs = opts.blobs ?? silentBlobs();
		this.limits = opts.limits ?? silentLimits();
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
		const expiresAt = new Date(now.getTime() + PAIRING_TTL_MS);
		const code = await this.mintUnusedPairingCode();
		await this.vault.createPairing({
			id,
			code,
			publicJwk,
			expiresAt,
			now,
		});
		return { id, code, expiresAt: expiresAt.toISOString() };
	}

	async getPairing(id: string) {
		return this.pairingView(await this.requireLivePairing(id));
	}

	async lookupPairing(sessionToken: string | undefined, code: string) {
		await this.requireUser(sessionToken);
		const row = await this.vault.getPairingByCode(code);
		if (!row) {
			throw new AuthError("pairing_missing", 404);
		}
		if (row.expiresAt.getTime() <= this.now().getTime()) {
			throw new AuthError("pairing_expired", 400);
		}
		return this.pairingView(row);
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
		const ctx = await this.requireCtx(sessionToken);
		if (!ctx.user.hasVault) {
			throw new AuthError("vault_missing", 409);
		}
		const now = this.now();
		this.assertLiveItem(item, now);
		const allowed = await this.limits.take("send", ctx.user.id);
		if (!allowed) {
			throw new AuthError("rate_limited", 429);
		}
		await this.vault.createItem(ctx.user.id, item, now);
		const record = { ...item, createdAt: now.toISOString() };
		await this.hub.publish(ctx.user.id, { v: 1, type: "item.created", item: record });
		await this.push.notify({
			userId: ctx.user.id,
			exceptDeviceId: ctx.device.id,
			title: `New item from ${ctx.user.displayName}`,
		});
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
		await this.vault.deleteItem(user.id, id);
		await this.hub.publish(user.id, { v: 1, type: "item.deleted", id });
	}

	async updateItem(sessionToken: string | undefined, id: string, patch: ItemUpdateRequest) {
		const ctx = await this.requireCtx(sessionToken);
		if (!ctx.user.hasVault) {
			throw new AuthError("vault_missing", 409);
		}
		const now = this.now();
		this.assertItemCipher(patch.ciphertext);
		const allowed = await this.limits.take("send", ctx.user.id);
		if (!allowed) {
			throw new AuthError("rate_limited", 429);
		}
		const result = await this.vault.updateTextItem(ctx.user.id, id, patch, now);
		if (result === "missing") {
			throw new AuthError("not_found", 404);
		}
		if (result === "not_text" || result === "expired") {
			throw new AuthError(result === "expired" ? "item_expired" : "item_invalid", 400);
		}
		const { ownerId: _ownerId, createdAt, ...rest } = result;
		const record = {
			...rest,
			createdAt: createdAt.toISOString(),
		};
		await this.hub.publish(ctx.user.id, { v: 1, type: "item.updated", item: record });
		return record;
	}

	async hubTicket(sessionToken: string | undefined) {
		const hub = hubOrigin(this.env);
		if (!this.env.HUB_SECRET || !hub) {
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
		return { ticket, url: `${hub.replace(/\/$/, "")}/ws` };
	}

	async requestUpload(
		sessionToken: string | undefined,
		body: { requestedMb: number; reason: string },
	) {
		const user = await this.requireUser(sessionToken);
		const requested = quotaGrantMbSchema.safeParse(body.requestedMb);
		if (!requested.success) {
			throw new AuthError("invalid_body", 400);
		}
		const now = this.now();
		const result = await this.vault.createUploadRequest({
			id: randomUUID(),
			userId: user.id,
			reason: body.reason,
			requestedBytes: quotaMbToBytes(requested.data),
			now,
		});
		if (result === "pending") {
			throw new AuthError("request_pending", 409);
		}
		await this.auth.insertAudit({
			actorId: user.id,
			action: "upload.requested",
			subjectType: "user",
			subjectId: user.id,
			now,
		});
		return { ok: true as const };
	}

	async listUploadRequests(sessionToken: string | undefined) {
		await this.requireAdmin(sessionToken);
		return { requests: await this.vault.listUploadRequests() };
	}

	async decideUpload(
		sessionToken: string | undefined,
		id: string,
		body: { status: "approved" | "denied"; grantedMb?: number; decisionNote?: string },
	) {
		const admin = await this.requireAdmin(sessionToken);
		let grantedBytes: number | null = null;
		if (body.status === "approved") {
			const granted = quotaGrantMbSchema.safeParse(body.grantedMb);
			if (!granted.success) {
				throw new AuthError("invalid_body", 400);
			}
			grantedBytes = quotaMbToBytes(granted.data);
		}
		const now = this.now();
		const result = await this.vault.decideUploadRequest({
			id,
			decidedBy: admin.id,
			status: body.status,
			grantedBytes,
			decisionNote: body.decisionNote ?? null,
			now,
		});
		if (result === "missing") {
			throw new AuthError("item_invalid", 404);
		}
		if (result === "decided") {
			throw new AuthError("invalid_body", 409);
		}
		await this.auth.insertAudit({
			actorId: admin.id,
			action: body.status === "approved" ? "upload.approved" : "upload.denied",
			subjectType: "upload_request",
			subjectId: id,
			now,
		});
		return { ok: true as const };
	}

	async uploadIntent(
		sessionToken: string | undefined,
		body: { kind: "image" | "file"; byteSize: number; chunkCount: number },
	) {
		const user = await this.requireUser(sessionToken);
		if (!user.canUpload) {
			throw new AuthError("forbidden", 403);
		}
		if (body.byteSize > FILE_MAX_BYTES + 2_097_152) {
			throw new AuthError("item_invalid", 400);
		}
		if (user.storageUsedBytes + body.byteSize > user.storageQuotaBytes) {
			throw new AuthError("quota_exceeded", 403);
		}
		if (!this.env.CAPABILITY_TOKEN_PRIVATE_KEY || !this.env.EDGE_URL) {
			throw new AuthError("capability_unconfigured", 503);
		}
		const blobId = randomUUID();
		const r2Key = randomUUID();
		await this.vault.createPendingBlob({
			id: blobId,
			ownerId: user.id,
			r2Key,
			byteSize: body.byteSize,
			chunkSize: 1_048_576,
			chunkCount: body.chunkCount,
			now: this.now(),
		});
		return {
			blobId,
			r2Key,
			maxBytes: body.byteSize,
			uploadUrl: `${this.env.EDGE_URL.replace(/\/$/, "")}/upload`,
		};
	}

	async uploadTicket(
		sessionToken: string | undefined,
		body: { blobId: string; purpose: "upload" | "stat" | "download" },
	) {
		if (!this.env.CAPABILITY_TOKEN_PRIVATE_KEY || !this.env.EDGE_URL) {
			throw new AuthError("capability_unconfigured", 503);
		}
		const user = await this.requireUser(sessionToken);
		if (!user.canUpload) {
			throw new AuthError("forbidden", 403);
		}
		const blob = await this.vault.getBlob(body.blobId);
		if (!blob || blob.ownerId !== user.id) {
			throw new AuthError("item_invalid", 404);
		}
		if (body.purpose !== "download" && blob.state !== "pending") {
			throw new AuthError("item_invalid", 409);
		}
		if (body.purpose === "download" && blob.state !== "committed") {
			throw new AuthError("item_invalid", 409);
		}
		const token = await signCapability(this.env.CAPABILITY_TOKEN_PRIVATE_KEY, {
			v: 1,
			purpose: body.purpose,
			userId: user.id,
			key: blob.r2Key,
			maxBytes: blob.byteSize,
			blobId: blob.id,
			exp: Math.floor(this.now().getTime() / 1000) + Math.floor(CAPABILITY_TTL_MS / 1000),
		});
		const path = body.purpose === "upload" ? "/upload" : body.purpose === "stat" ? "/stat" : "/dl";
		return { token, url: `${this.env.EDGE_URL.replace(/\/$/, "")}${path}` };
	}

	async commitUpload(
		sessionToken: string | undefined,
		body: {
			blobId: string;
			itemId: string;
			kind: "image" | "file";
			metaCiphertext: string;
			iv: string;
			wrappedKey: { iv: string; bytes: string };
			chunkSize: number;
			chunkCount: number;
			sha256: string;
			expiresAt: string;
		},
	) {
		const ctx = await this.requireCtx(sessionToken);
		if (!ctx.user.canUpload) {
			throw new AuthError("forbidden", 403);
		}
		const blob = await this.vault.getBlob(body.blobId);
		if (!blob || blob.ownerId !== ctx.user.id || blob.state !== "pending") {
			throw new AuthError("item_invalid", 404);
		}
		const expiresAt = Date.parse(body.expiresAt);
		const now = this.now();
		if (Number.isNaN(expiresAt) || expiresAt <= now.getTime()) {
			throw new AuthError("item_expired", 400);
		}
		if (expiresAt > now.getTime() + BLOB_TTL_MS + 60_000) {
			throw new AuthError("item_invalid", 400);
		}
		const ticket = await this.uploadTicket(sessionToken, { blobId: blob.id, purpose: "stat" });
		const sized = await this.blobs.stat(ticket.token);
		if (!sized || sized.bytes <= 0 || sized.bytes > blob.byteSize) {
			throw new AuthError("item_invalid", 400);
		}
		const result = await this.vault.commitBlobAndItem({
			blob,
			actualBytes: sized.bytes,
			sha256: fromBase64Url(body.sha256),
			item: {
				id: body.itemId,
				kind: body.kind,
				metaCiphertext: body.metaCiphertext,
				iv: body.iv,
				wrappedKey: body.wrappedKey,
				expiresAt: new Date(expiresAt),
			},
			now,
		});
		if (result === "quota") {
			throw new AuthError("quota_exceeded", 403);
		}
		const record = {
			id: body.itemId,
			kind: body.kind,
			metaCiphertext: body.metaCiphertext,
			iv: body.iv,
			wrappedKey: body.wrappedKey,
			blobId: blob.id,
			byteSize: sized.bytes,
			expiresAt: body.expiresAt,
			createdAt: now.toISOString(),
		};
		await this.hub.publish(ctx.user.id, { v: 1, type: "item.created", item: record });
		await this.push.notify({
			userId: ctx.user.id,
			exceptDeviceId: ctx.device.id,
			title: `New item from ${ctx.user.displayName}`,
		});
		return record;
	}

	async vapidPublic(sessionToken: string | undefined) {
		await this.requireUser(sessionToken);
		if (!this.env.VAPID_PUBLIC_KEY) {
			throw new AuthError("push_unconfigured", 503);
		}
		return { publicKey: this.env.VAPID_PUBLIC_KEY };
	}

	async subscribePush(
		sessionToken: string | undefined,
		body: { endpoint: string; keys: { p256dh: string; auth: string } },
	) {
		if (!this.env.VAPID_PUBLIC_KEY) {
			throw new AuthError("push_unconfigured", 503);
		}
		const ctx = await this.requireCtx(sessionToken);
		await this.vault.savePushSubscription({
			deviceId: ctx.device.id,
			endpoint: body.endpoint,
			p256dh: body.keys.p256dh,
			auth: body.keys.auth,
		});
		return { ok: true as const };
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

	async adminUsage(sessionToken: string | undefined) {
		await this.requireAdmin(sessionToken);
		const snapshot = await this.vault.usageSnapshot();
		const directory = await this.auth.listDirectory();
		return {
			r2CommittedBytes: snapshot.committedBytes,
			r2PendingBytes: snapshot.pendingBytes,
			r2CeilingBytes: R2_STORAGE_CEILING_BYTES,
			classAEstimate: snapshot.classAEstimate,
			classACeiling: R2_CLASS_A_CEILING,
			classBCounted: false as const,
			classBCeiling: R2_CLASS_B_CEILING,
			seatsClaimed: directory.seatsClaimed,
			seatsTotal: SEAT_CEILING,
			users: directory.users.map((user) => ({
				handle: user.handle,
				storageUsedBytes: user.storageUsedBytes,
				storageQuotaBytes: user.storageQuotaBytes,
			})),
		};
	}

	async publishDeviceRevoked(userId: string, deviceId: string): Promise<void> {
		await this.hub.publish(userId, { v: 1, type: "device.revoked", id: deviceId });
	}

	async prune(): Promise<{ keepR2Keys: string[]; deleteR2Keys: string[] }> {
		return this.vault.prune(this.now());
	}

	private async pairingView(row: Awaited<ReturnType<VaultService["requireLivePairing"]>>) {
		const handle = row.userId ? ((await this.auth.getUserById(row.userId))?.handle ?? null) : null;
		return {
			id: row.id,
			expiresAt: row.expiresAt.toISOString(),
			publicJwk: row.publicJwk,
			handle,
			wrap: row.wrap,
		};
	}

	private async mintUnusedPairingCode(): Promise<string> {
		for (let attempt = 0; attempt < 8; attempt += 1) {
			const code = mintPairingCode();
			if (!(await this.vault.getPairingByCode(code))) {
				return code;
			}
		}
		throw new AuthError("rate_limited", 429);
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

	private async requireAdmin(sessionToken: string | undefined) {
		const user = await this.requireUser(sessionToken);
		if (user.role !== "admin") {
			throw new AuthError("forbidden", 403);
		}
		return user;
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

	private assertItemCipher(ciphertext: string): void {
		const cipher = fromBase64Url(ciphertext);
		if (cipher.byteLength > TEXT_CIPHERTEXT_MAX_BYTES) {
			throw new AuthError("item_invalid", 400);
		}
	}

	private assertLiveItem(item: ItemCreateRequest, now: Date): void {
		this.assertItemCipher(item.ciphertext);
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
