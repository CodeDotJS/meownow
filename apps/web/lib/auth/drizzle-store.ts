import {
	type AppDatabase,
	auditLog,
	blobs,
	devices,
	type HttpDatabase,
	inviteAsks,
	inviteState,
	invites,
	items,
	pairingSessions,
	pushSubscriptions,
	sessions,
	uploadRequests,
	users,
	withDb,
	withTx,
} from "@meownow/db";
import {
	type ItemCreateRequest,
	type ItemUpdateRequest,
	type PairingWrapRequest,
	type PublicJwk,
	pairingWrapRequestSchema,
	type WrappedKeyWire,
} from "@meownow/protocol";
import { and, desc, eq, inArray, isNull, ne, type SQL, sql } from "drizzle-orm";
import { planPrune } from "../vault/prune";
import type {
	BlobRow,
	PairingRecord,
	StoredItem,
	UploadRequestRow,
	VaultRecord,
	VaultStore,
} from "../vault/store";
import {
	type AdminEnrollCommit,
	type AdminEnrollCommitResult,
	type AuditEntry,
	AuthError,
	type AuthStore,
	type DeviceWithUser,
	type InviteAskRow,
	type InviteRow,
	type LoginCommit,
	type RegistrationCommit,
	type RegistrationCommitResult,
	type SessionContext,
	type UserRow,
} from "./store";

type DbTx = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

function mapUser(row: typeof users.$inferSelect): UserRow {
	return {
		id: row.id,
		handle: row.handle,
		displayName: row.displayName,
		role: row.role,
		canUpload: row.canUpload,
		hasVault: row.wrappedVaultRecovery !== null,
		storageQuotaBytes: row.storageQuotaBytes,
		storageUsedBytes: row.storageUsedBytes,
		suspendedAt: row.suspendedAt,
	};
}

function mapInvite(row: typeof invites.$inferSelect): InviteRow {
	return {
		id: row.id,
		tokenHash: row.tokenHash,
		createdBy: row.createdBy,
		note: row.note,
		expiresAt: row.expiresAt,
		redeemedBy: row.redeemedBy,
		redeemedAt: row.redeemedAt,
		revokedAt: row.revokedAt,
		createdAt: row.createdAt,
	};
}

export class DrizzleAuthStore implements AuthStore, VaultStore {
	constructor(private readonly connectionString: string) {}

	private async withDb<T>(fn: (db: HttpDatabase) => Promise<T>): Promise<T> {
		return withDb(this.connectionString, fn);
	}

	private async withTx<T>(fn: (tx: DbTx) => Promise<T>): Promise<T> {
		return withTx(this.connectionString, fn);
	}

	async getInviteByTokenHash(hash: Buffer): Promise<InviteRow | null> {
		return this.withDb(async (db) => {
			const rows = await db.select().from(invites).where(eq(invites.tokenHash, hash)).limit(1);
			const row = rows[0];
			return row ? mapInvite(row) : null;
		});
	}

	async getInviteById(id: string): Promise<InviteRow | null> {
		return this.withDb(async (db) => {
			const rows = await db.select().from(invites).where(eq(invites.id, id)).limit(1);
			const row = rows[0];
			return row ? mapInvite(row) : null;
		});
	}

	async listInvites(): Promise<InviteRow[]> {
		return this.withDb(async (db) => {
			const rows = await db.select().from(invites);
			return rows.map(mapInvite).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
		});
	}

	async handleTaken(handle: string): Promise<boolean> {
		return (await this.getUserByHandle(handle)) !== null;
	}

	async getUserByHandle(handle: string): Promise<UserRow | null> {
		return this.withDb(async (db) => {
			const rows = await db.select().from(users).where(eq(users.handle, handle)).limit(1);
			const row = rows[0];
			return row ? mapUser(row) : null;
		});
	}

	async getUserById(id: string): Promise<UserRow | null> {
		return this.withDb(async (db) => {
			const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
			const row = rows[0];
			return row ? mapUser(row) : null;
		});
	}

	async countDevices(userId: string): Promise<number> {
		return this.withDb(async (db) => {
			const rows = await db
				.select({ id: devices.id })
				.from(devices)
				.where(eq(devices.userId, userId));
			return rows.length;
		});
	}

	async getDeviceByCredentialId(credentialId: Buffer): Promise<DeviceWithUser | null> {
		return this.withDb(async (db) => {
			const rows = await db
				.select()
				.from(devices)
				.innerJoin(users, eq(devices.userId, users.id))
				.where(eq(devices.credentialId, credentialId))
				.limit(1);
			const row = rows[0];
			if (!row) {
				return null;
			}
			return {
				id: row.devices.id,
				userId: row.devices.userId,
				label: row.devices.label,
				credentialId: row.devices.credentialId,
				publicKey: row.devices.publicKey,
				signCount: row.devices.signCount,
				transports: row.devices.transports,
				revokedAt: row.devices.revokedAt,
				user: mapUser(row.users),
			};
		});
	}

	async getSessionByTokenHash(hash: Buffer): Promise<SessionContext | null> {
		return this.withDb(async (db) => {
			const rows = await db
				.select()
				.from(sessions)
				.innerJoin(devices, eq(sessions.deviceId, devices.id))
				.innerJoin(users, eq(devices.userId, users.id))
				.where(eq(sessions.tokenHash, hash))
				.limit(1);
			const row = rows[0];
			if (!row) {
				return null;
			}
			return {
				session: {
					tokenHash: row.sessions.tokenHash,
					deviceId: row.sessions.deviceId,
					expiresAt: row.sessions.expiresAt,
					createdAt: row.sessions.createdAt,
					lastUsed: row.sessions.lastUsed,
				},
				device: {
					id: row.devices.id,
					userId: row.devices.userId,
					label: row.devices.label,
					credentialId: row.devices.credentialId,
					publicKey: row.devices.publicKey,
					signCount: row.devices.signCount,
					transports: row.devices.transports,
					revokedAt: row.devices.revokedAt,
				},
				user: mapUser(row.users),
			};
		});
	}

	async createInvite(input: {
		createdBy: string;
		note: string | null;
		tokenHash: Buffer;
		expiresAt: Date;
		now: Date;
	}): Promise<{ id: string }> {
		return this.withDb(async (db) => {
			const rows = await db
				.insert(invites)
				.values({
					tokenHash: input.tokenHash,
					createdBy: input.createdBy,
					note: input.note,
					expiresAt: input.expiresAt,
					createdAt: input.now,
				})
				.returning({ id: invites.id });
			const id = rows[0]?.id;
			if (!id) {
				throw new Error("failed to insert invite");
			}
			return { id };
		});
	}

	async revokeInvite(id: string, now: Date): Promise<boolean> {
		return this.withDb(async (db) => {
			const rows = await db.select().from(invites).where(eq(invites.id, id)).limit(1);
			const invite = rows[0];
			if (!invite || invite.redeemedAt) {
				return false;
			}
			await db.update(invites).set({ revokedAt: now }).where(eq(invites.id, id));
			return true;
		});
	}

	async countOpenAsks(): Promise<number> {
		return this.withDb(async (db) => {
			const rows = await db
				.select({ id: inviteAsks.id })
				.from(inviteAsks)
				.where(isNull(inviteAsks.dismissedAt));
			return rows.length;
		});
	}

	async createAsk(input: { email: string; note: string; now: Date }): Promise<{ id: string }> {
		return this.withDb(async (db) => {
			const rows = await db
				.insert(inviteAsks)
				.values({ email: input.email, note: input.note, createdAt: input.now })
				.returning({ id: inviteAsks.id });
			const id = rows[0]?.id;
			if (!id) {
				throw new Error("failed to insert invite ask");
			}
			return { id };
		});
	}

	async listOpenAsks(): Promise<InviteAskRow[]> {
		return this.withDb(async (db) => {
			const rows = await db
				.select()
				.from(inviteAsks)
				.where(isNull(inviteAsks.dismissedAt))
				.orderBy(desc(inviteAsks.createdAt));
			return rows.map((row) => ({
				id: row.id,
				email: row.email,
				note: row.note,
				dismissedAt: row.dismissedAt,
				createdAt: row.createdAt,
			}));
		});
	}

	async dismissAsk(id: string, now: Date): Promise<boolean> {
		return this.withDb(async (db) => {
			const rows = await db.select().from(inviteAsks).where(eq(inviteAsks.id, id)).limit(1);
			const ask = rows[0];
			if (!ask || ask.dismissedAt) {
				return false;
			}
			await db.update(inviteAsks).set({ dismissedAt: now }).where(eq(inviteAsks.id, id));
			return true;
		});
	}

	async completeRegistration(input: RegistrationCommit): Promise<RegistrationCommitResult> {
		return this.withTx(async (tx) => {
			const inviteRows = await tx
				.select()
				.from(invites)
				.where(eq(invites.tokenHash, input.inviteTokenHash))
				.limit(1);
			const invite = inviteRows[0];
			if (!invite || inviteState(invite, input.now) !== "ok") {
				return "invite_invalid" as const;
			}
			const existing = await tx
				.select({ id: users.id })
				.from(users)
				.where(eq(users.handle, input.handle))
				.limit(1);
			if (existing[0]) {
				return "handle_taken" as const;
			}
			await tx.insert(users).values({
				id: input.userId,
				handle: input.handle,
				displayName: input.displayName,
				role: "member",
			});
			await insertDevice(tx, input.userId, input.device);
			await tx
				.update(invites)
				.set({ redeemedBy: input.userId, redeemedAt: input.now })
				.where(eq(invites.id, invite.id));
			await tx.insert(sessions).values({
				tokenHash: input.session.tokenHash,
				deviceId: input.device.id,
				expiresAt: input.session.expiresAt,
				createdAt: input.now,
				lastUsed: input.now,
			});
			return "ok" as const;
		});
	}

	async completeAdminEnroll(input: AdminEnrollCommit): Promise<AdminEnrollCommitResult> {
		return this.withTx(async (tx) => {
			const existing = await tx
				.select({ id: devices.id })
				.from(devices)
				.where(eq(devices.userId, input.userId))
				.limit(1);
			if (existing[0]) {
				return "admin_enrolled" as const;
			}
			await insertDevice(tx, input.userId, input.device);
			await tx.insert(sessions).values({
				tokenHash: input.session.tokenHash,
				deviceId: input.device.id,
				expiresAt: input.session.expiresAt,
				createdAt: input.now,
				lastUsed: input.now,
			});
			return "ok" as const;
		});
	}

	async completeLogin(input: LoginCommit): Promise<void> {
		await this.withTx(async (tx) => {
			await tx
				.update(devices)
				.set({ signCount: input.signCount, lastSeenAt: input.now })
				.where(eq(devices.id, input.deviceId));
			await tx.insert(sessions).values({
				tokenHash: input.session.tokenHash,
				deviceId: input.deviceId,
				expiresAt: input.session.expiresAt,
				createdAt: input.now,
				lastUsed: input.now,
			});
		});
	}

	async deleteSession(tokenHash: Buffer): Promise<void> {
		await this.withDb(async (db) => {
			await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
		});
	}

	async touchSession(tokenHash: Buffer, expiresAt: Date, now: Date): Promise<void> {
		await this.withDb(async (db) => {
			await db
				.update(sessions)
				.set({ expiresAt, lastUsed: now })
				.where(eq(sessions.tokenHash, tokenHash));
		});
	}

	async insertAudit(input: {
		actorId: string | null;
		action: string;
		subjectType: string | null;
		subjectId: string | null;
		now: Date;
	}): Promise<void> {
		await this.withDb(async (db) => {
			await db.insert(auditLog).values({
				actorId: input.actorId,
				action: input.action,
				subjectType: input.subjectType,
				subjectId: input.subjectId,
				createdAt: input.now,
			});
		});
	}

	async listDirectory() {
		return this.withDb(async (db) => {
			const userRows = await db.select().from(users);
			const deviceRows = await db.select().from(devices);
			return {
				users: userRows
					.map((row) => ({
						...mapUser(row),
						devices: deviceRows
							.filter((device) => device.userId === row.id)
							.map((device) => ({
								id: device.id,
								userId: device.userId,
								label: device.label,
								revokedAt: device.revokedAt,
								lastSeenAt: device.lastSeenAt,
								createdAt: device.createdAt,
							})),
					}))
					.sort((a, b) => a.handle.localeCompare(b.handle)),
				seatsClaimed: userRows.length,
			};
		});
	}

	async listAudit(): Promise<AuditEntry[]> {
		return this.withDb(async (db) => {
			const rows = await db.select().from(auditLog).orderBy(desc(auditLog.id)).limit(100);
			return rows.map((row) => ({
				id: row.id,
				actorId: row.actorId,
				action: row.action,
				subjectType: row.subjectType,
				subjectId: row.subjectId,
				createdAt: row.createdAt,
			}));
		});
	}

	async revokeDevice(id: string, now: Date): Promise<{ userId: string } | "missing" | "already"> {
		return this.withTx(async (tx) => {
			const rows = await tx.select().from(devices).where(eq(devices.id, id)).limit(1);
			const device = rows[0];
			if (!device) {
				return "missing" as const;
			}
			if (device.revokedAt) {
				return "already" as const;
			}
			await tx.update(devices).set({ revokedAt: now }).where(eq(devices.id, id));
			await tx.delete(sessions).where(eq(sessions.deviceId, id));
			return { userId: device.userId };
		});
	}

	async removeUser(id: string): Promise<"ok" | "missing" | "last_admin"> {
		return this.withTx(async (tx) => {
			const rows = await tx.select().from(users).where(eq(users.id, id)).limit(1);
			const user = rows[0];
			if (!user) {
				return "missing" as const;
			}
			if (user.role === "admin") {
				const others = await tx
					.select({ id: users.id })
					.from(users)
					.where(and(eq(users.role, "admin"), ne(users.id, id)));
				if (others.length === 0) {
					return "last_admin" as const;
				}
			}
			await tx.update(auditLog).set({ actorId: null }).where(eq(auditLog.actorId, id));
			await tx.update(items).set({ senderId: null }).where(eq(items.senderId, id));
			await tx
				.update(uploadRequests)
				.set({ decidedBy: null })
				.where(eq(uploadRequests.decidedBy, id));
			await tx.update(invites).set({ redeemedBy: null }).where(eq(invites.redeemedBy, id));
			await tx.delete(invites).where(eq(invites.createdBy, id));
			await tx.delete(users).where(eq(users.id, id));
			return "ok" as const;
		});
	}

	async getVault(userId: string): Promise<VaultRecord | null> {
		return this.withDb(async (db) => {
			const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
			const row = rows[0];
			return row ? vaultFromUser(row) : null;
		});
	}

	async saveVault(userId: string, vault: VaultRecord): Promise<"ok" | "vault_exists"> {
		return this.withDb(async (db) => {
			const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
			const row = rows[0];
			if (!row) {
				throw new Error("user missing");
			}
			if (row.wrappedVaultRecovery) {
				return "vault_exists" as const;
			}
			await db
				.update(users)
				.set({
					identityPub: vault.identityPub,
					wrappedVaultRecovery: wireToBytes(vault.wrappedVaultRecovery),
					recoverySalt: Buffer.from(vault.recoverySalt, "base64url"),
					recoveryVerifierHash: vault.recoveryVerifierHash,
				})
				.where(eq(users.id, userId));
			return "ok" as const;
		});
	}

	async getVaultByHandle(handle: string): Promise<{ userId: string; vault: VaultRecord } | null> {
		return this.withDb(async (db) => {
			const rows = await db.select().from(users).where(eq(users.handle, handle)).limit(1);
			const row = rows[0];
			const vault = row ? vaultFromUser(row) : null;
			if (!row || !vault) {
				return null;
			}
			return { userId: row.id, vault };
		});
	}

	async createPairing(input: {
		id: string;
		code: string;
		publicJwk: PublicJwk;
		expiresAt: Date;
		now: Date;
	}): Promise<void> {
		await this.withDb(async (db) => {
			await db.insert(pairingSessions).values({
				id: input.id,
				code: input.code,
				newDevicePub: input.publicJwk,
				fingerprint: "",
				expiresAt: input.expiresAt,
				createdAt: input.now,
			});
		});
	}

	async getPairing(id: string): Promise<PairingRecord | null> {
		return this.pairingWhere(eq(pairingSessions.id, id));
	}

	async getPairingByCode(code: string): Promise<PairingRecord | null> {
		return this.pairingWhere(eq(pairingSessions.code, code));
	}

	private pairingWhere(where: SQL): Promise<PairingRecord | null> {
		return this.withDb(async (db) => {
			const rows = await db.select().from(pairingSessions).where(where).limit(1);
			const row = rows[0];
			if (!row) {
				return null;
			}
			return {
				id: row.id,
				userId: row.userId,
				publicJwk: row.newDevicePub as PublicJwk,
				wrap: row.wrappedVault ? parsePairingWrap(row.wrappedVault) : null,
				fingerprint: row.fingerprint,
				expiresAt: row.expiresAt,
				createdAt: row.createdAt,
			};
		});
	}

	async savePairingWrap(input: {
		id: string;
		userId: string;
		wrap: PairingWrapRequest;
		now: Date;
	}): Promise<"ok" | "missing" | "complete"> {
		return this.withDb(async (db) => {
			const rows = await db
				.select()
				.from(pairingSessions)
				.where(eq(pairingSessions.id, input.id))
				.limit(1);
			const row = rows[0];
			if (!row) {
				return "missing" as const;
			}
			if (row.wrappedVault) {
				return "complete" as const;
			}
			await db
				.update(pairingSessions)
				.set({
					userId: input.userId,
					wrappedVault: Buffer.from(JSON.stringify(input.wrap), "utf8"),
					fingerprint: input.wrap.fingerprint,
				})
				.where(eq(pairingSessions.id, input.id));
			return "ok" as const;
		});
	}

	async deletePairing(id: string): Promise<void> {
		await this.withDb(async (db) => {
			await db.delete(pairingSessions).where(eq(pairingSessions.id, id));
		});
	}

	async createItem(ownerId: string, item: ItemCreateRequest, now: Date): Promise<void> {
		await this.withDb(async (db) => {
			const inserted = await db
				.insert(items)
				.values({
					id: item.id,
					ownerId,
					kind: item.kind,
					ciphertext: Buffer.from(item.ciphertext, "base64url"),
					metaCiphertext: Buffer.from(item.metaCiphertext, "base64url"),
					iv: Buffer.from(item.iv, "base64url"),
					byteSize: item.byteSize,
					expiresAt: new Date(item.expiresAt),
					createdAt: now,
				})
				.onConflictDoNothing({ target: items.id })
				.returning({ id: items.id });
			if (inserted.length > 0) {
				return;
			}
			const [existing] = await db
				.select({ ownerId: items.ownerId })
				.from(items)
				.where(eq(items.id, item.id))
				.limit(1);
			if (existing && existing.ownerId !== ownerId) {
				throw new AuthError("forbidden", 403);
			}
		});
	}

	async updateTextItem(
		ownerId: string,
		id: string,
		patch: ItemUpdateRequest,
		now: Date,
	): Promise<StoredItem | "missing" | "not_text" | "expired"> {
		return this.withDb(async (db) => {
			const [row] = await db
				.select()
				.from(items)
				.where(and(eq(items.id, id), eq(items.ownerId, ownerId)))
				.limit(1);
			if (!row) {
				return "missing";
			}
			if (row.kind !== "text" && row.kind !== "link") {
				return "not_text";
			}
			if (asDate(row.expiresAt).getTime() <= now.getTime()) {
				return "expired";
			}
			const [updated] = await db
				.update(items)
				.set({
					kind: patch.kind,
					ciphertext: Buffer.from(patch.ciphertext, "base64url"),
					metaCiphertext: Buffer.from(patch.metaCiphertext, "base64url"),
					iv: Buffer.from(patch.iv, "base64url"),
					byteSize: patch.byteSize,
				})
				.where(eq(items.id, id))
				.returning();
			if (!updated) {
				return "missing";
			}
			return {
				id: updated.id,
				kind: updated.kind,
				ciphertext: updated.ciphertext ? b64urlFromBytea(updated.ciphertext) : undefined,
				metaCiphertext: b64urlFromBytea(updated.metaCiphertext),
				iv: b64urlFromBytea(updated.iv),
				wrappedKey: updated.wrappedKey ? bytesToWire(updated.wrappedKey) : undefined,
				blobId: updated.blobId ?? undefined,
				byteSize: updated.byteSize,
				expiresAt: asDate(updated.expiresAt).toISOString(),
				ownerId: updated.ownerId,
				createdAt: asDate(updated.createdAt),
			};
		});
	}

	async listItems(ownerId: string): Promise<StoredItem[]> {
		return this.withDb(async (db) => {
			const rows = await db.select().from(items).where(eq(items.ownerId, ownerId));
			return rows
				.flatMap((row) => {
					try {
						const createdAt = asDate(row.createdAt);
						return [
							{
								id: row.id,
								kind: row.kind,
								ciphertext: row.ciphertext ? b64urlFromBytea(row.ciphertext) : undefined,
								metaCiphertext: b64urlFromBytea(row.metaCiphertext),
								iv: b64urlFromBytea(row.iv),
								wrappedKey: row.wrappedKey ? bytesToWire(row.wrappedKey) : undefined,
								blobId: row.blobId ?? undefined,
								byteSize: row.byteSize,
								expiresAt: asDate(row.expiresAt).toISOString(),
								ownerId: row.ownerId,
								createdAt,
							},
						];
					} catch {
						return [];
					}
				})
				.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
		});
	}

	async deleteItem(ownerId: string, id: string): Promise<boolean> {
		return this.withDb(async (db) => {
			const deleted = await db
				.delete(items)
				.where(and(eq(items.id, id), eq(items.ownerId, ownerId)))
				.returning({ id: items.id });
			return deleted.length > 0;
		});
	}

	async savePushSubscription(input: {
		deviceId: string;
		endpoint: string;
		p256dh: string;
		auth: string;
	}): Promise<void> {
		await this.withDb(async (db) => {
			await db
				.insert(pushSubscriptions)
				.values(input)
				.onConflictDoUpdate({
					target: pushSubscriptions.endpoint,
					set: { deviceId: input.deviceId, p256dh: input.p256dh, auth: input.auth },
				});
		});
	}

	async listPushSubscriptions(
		userId: string,
		exceptDeviceId: string,
	): Promise<Array<{ endpoint: string; p256dh: string; auth: string }>> {
		return this.withDb(async (db) => {
			const rows = await db
				.select({
					endpoint: pushSubscriptions.endpoint,
					p256dh: pushSubscriptions.p256dh,
					auth: pushSubscriptions.auth,
				})
				.from(pushSubscriptions)
				.innerJoin(devices, eq(devices.id, pushSubscriptions.deviceId))
				.where(
					and(
						eq(devices.userId, userId),
						ne(devices.id, exceptDeviceId),
						isNull(devices.revokedAt),
					),
				);
			return rows;
		});
	}

	async deletePushSubscription(endpoint: string): Promise<void> {
		await this.withDb(async (db) => {
			await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
		});
	}

	async createUploadRequest(input: {
		id: string;
		userId: string;
		reason: string;
		requestedBytes: number;
		now: Date;
	}): Promise<"ok" | "pending"> {
		return this.withDb(async (db) => {
			const pending = await db
				.select({ id: uploadRequests.id })
				.from(uploadRequests)
				.where(and(eq(uploadRequests.userId, input.userId), eq(uploadRequests.status, "pending")))
				.limit(1);
			if (pending[0]) {
				return "pending" as const;
			}
			await db.insert(uploadRequests).values({
				id: input.id,
				userId: input.userId,
				reason: input.reason,
				requestedBytes: input.requestedBytes,
				createdAt: input.now,
			});
			return "ok" as const;
		});
	}

	async listUploadRequests(): Promise<UploadRequestRow[]> {
		return this.withDb(async (db) => {
			const rows = await db
				.select({
					id: uploadRequests.id,
					userId: uploadRequests.userId,
					handle: users.handle,
					reason: uploadRequests.reason,
					requestedBytes: uploadRequests.requestedBytes,
					status: uploadRequests.status,
					decidedBy: uploadRequests.decidedBy,
					decidedAt: uploadRequests.decidedAt,
					decisionNote: uploadRequests.decisionNote,
					grantedBytes: uploadRequests.grantedBytes,
					createdAt: uploadRequests.createdAt,
				})
				.from(uploadRequests)
				.innerJoin(users, eq(users.id, uploadRequests.userId));
			return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
		});
	}

	async decideUploadRequest(input: {
		id: string;
		decidedBy: string;
		status: "approved" | "denied";
		grantedBytes: number | null;
		decisionNote: string | null;
		now: Date;
	}): Promise<"ok" | "missing" | "decided"> {
		return this.withTx(async (tx) => {
			const rows = await tx
				.select()
				.from(uploadRequests)
				.where(eq(uploadRequests.id, input.id))
				.limit(1);
			const row = rows[0];
			if (!row) {
				return "missing" as const;
			}
			if (row.status !== "pending") {
				return "decided" as const;
			}
			await tx
				.update(uploadRequests)
				.set({
					status: input.status,
					decidedBy: input.decidedBy,
					decidedAt: input.now,
					decisionNote: input.decisionNote,
					grantedBytes: input.grantedBytes,
				})
				.where(eq(uploadRequests.id, input.id));
			if (input.status === "approved" && input.grantedBytes) {
				await tx
					.update(users)
					.set({ canUpload: true, storageQuotaBytes: input.grantedBytes })
					.where(eq(users.id, row.userId));
			}
			return "ok" as const;
		});
	}

	async createPendingBlob(input: {
		id: string;
		ownerId: string;
		r2Key: string;
		byteSize: number;
		chunkSize: number;
		chunkCount: number;
		now: Date;
	}): Promise<void> {
		await this.withDb(async (db) => {
			await db.insert(blobs).values({
				id: input.id,
				ownerId: input.ownerId,
				r2Key: input.r2Key,
				byteSize: input.byteSize,
				chunkSize: input.chunkSize,
				chunkCount: input.chunkCount,
				sha256: Buffer.alloc(32),
				state: "pending",
				createdAt: input.now,
			});
		});
	}

	async getBlob(id: string): Promise<BlobRow | null> {
		return this.withDb(async (db) => {
			const rows = await db.select().from(blobs).where(eq(blobs.id, id)).limit(1);
			const row = rows[0];
			if (!row) {
				return null;
			}
			return {
				id: row.id,
				ownerId: row.ownerId,
				r2Key: row.r2Key,
				byteSize: row.byteSize,
				chunkSize: row.chunkSize,
				chunkCount: row.chunkCount,
				sha256: row.sha256,
				state: row.state === "committed" ? "committed" : "pending",
				createdAt: row.createdAt,
				committedAt: row.committedAt,
			};
		});
	}

	async commitBlobAndItem(input: {
		blob: BlobRow;
		actualBytes: number;
		sha256: Buffer;
		item: {
			id: string;
			kind: "image" | "file";
			metaCiphertext: string;
			iv: string;
			wrappedKey: WrappedKeyWire;
			expiresAt: Date;
		};
		now: Date;
	}): Promise<"ok" | "quota"> {
		return this.withTx(async (tx) => {
			const locked = await tx
				.select()
				.from(users)
				.where(eq(users.id, input.blob.ownerId))
				.for("update")
				.limit(1);
			const user = locked[0];
			if (!user || user.storageUsedBytes + input.actualBytes > user.storageQuotaBytes) {
				return "quota" as const;
			}
			await tx
				.update(blobs)
				.set({
					state: "committed",
					byteSize: input.actualBytes,
					sha256: input.sha256,
					committedAt: input.now,
				})
				.where(eq(blobs.id, input.blob.id));
			await tx.insert(items).values({
				id: input.item.id,
				ownerId: input.blob.ownerId,
				kind: input.item.kind,
				metaCiphertext: Buffer.from(input.item.metaCiphertext, "base64url"),
				iv: Buffer.from(input.item.iv, "base64url"),
				wrappedKey: Buffer.from(JSON.stringify(input.item.wrappedKey), "utf8"),
				blobId: input.blob.id,
				byteSize: input.actualBytes,
				expiresAt: input.item.expiresAt,
				createdAt: input.now,
			});
			await tx
				.update(users)
				.set({ storageUsedBytes: sql`${users.storageUsedBytes} + ${input.actualBytes}` })
				.where(eq(users.id, input.blob.ownerId));
			return "ok" as const;
		});
	}

	async addDeviceAndSession(input: {
		userId: string;
		now: Date;
		device: RegistrationCommit["device"];
		session: RegistrationCommit["session"];
	}): Promise<void> {
		await this.withTx(async (tx) => {
			await insertDevice(tx, input.userId, input.device);
			await tx.insert(sessions).values({
				tokenHash: input.session.tokenHash,
				deviceId: input.device.id,
				expiresAt: input.session.expiresAt,
				createdAt: input.now,
				lastUsed: input.now,
			});
		});
	}

	async usageSnapshot(): Promise<{
		committedBytes: number;
		pendingBytes: number;
		classAEstimate: number;
	}> {
		return this.withDb(async (db) => {
			const rows = await db.select().from(blobs);
			let committedBytes = 0;
			let pendingBytes = 0;
			let classAEstimate = 0;
			for (const row of rows) {
				classAEstimate += row.chunkCount;
				if (row.state === "committed") {
					committedBytes += row.byteSize;
				} else {
					pendingBytes += row.byteSize;
				}
			}
			return { committedBytes, pendingBytes, classAEstimate };
		});
	}

	async prune(now: Date): Promise<{ keepR2Keys: string[]; deleteR2Keys: string[] }> {
		return this.withTx(async (tx) => {
			const [itemRows, blobRows, pairingRows, sessionRows] = await Promise.all([
				tx.select().from(items),
				tx.select().from(blobs),
				tx.select().from(pairingSessions),
				tx.select().from(sessions),
			]);
			const plan = planPrune({
				now: now.getTime(),
				items: itemRows.map((row) => ({
					id: row.id,
					pinned: row.pinned,
					expiresAt: row.expiresAt.getTime(),
					blobId: row.blobId,
				})),
				blobs: blobRows.map((row) => ({
					id: row.id,
					r2Key: row.r2Key,
					state: row.state === "committed" ? "committed" : "pending",
					createdAt: row.createdAt.getTime(),
					ownerId: row.ownerId,
					byteSize: row.byteSize,
				})),
				pairings: pairingRows.map((row) => ({
					id: row.id,
					expiresAt: row.expiresAt.getTime(),
				})),
				sessions: sessionRows.map((row) => ({
					key: row.tokenHash.toString("hex"),
					expiresAt: row.expiresAt.getTime(),
				})),
			});
			if (plan.deleteItemIds.length > 0) {
				await tx.delete(items).where(inArray(items.id, plan.deleteItemIds));
			}
			if (plan.deletePairingIds.length > 0) {
				await tx.delete(pairingSessions).where(inArray(pairingSessions.id, plan.deletePairingIds));
			}
			if (plan.deleteSessionKeys.length > 0) {
				const hashes = plan.deleteSessionKeys.map((key) => Buffer.from(key, "hex"));
				await tx.delete(sessions).where(inArray(sessions.tokenHash, hashes));
			}
			if (plan.deleteBlobIds.length > 0) {
				await tx.delete(blobs).where(inArray(blobs.id, plan.deleteBlobIds));
			}
			for (const row of plan.decrementUsage) {
				await tx
					.update(users)
					.set({
						storageUsedBytes: sql`greatest(0, ${users.storageUsedBytes} - ${row.bytes})`,
					})
					.where(eq(users.id, row.ownerId));
			}
			return { keepR2Keys: plan.keepR2Keys, deleteR2Keys: plan.deleteR2Keys };
		});
	}
}

async function insertDevice(
	tx: DbTx,
	userId: string,
	device: RegistrationCommit["device"],
): Promise<void> {
	await tx.insert(devices).values({
		id: device.id,
		userId,
		label: device.label,
		credentialId: device.credentialId,
		publicKey: device.publicKey,
		signCount: device.signCount,
		transports: device.transports ?? undefined,
		aaguid: device.aaguid,
		backedUp: device.backedUp,
	});
}

function wireToBytes(wire: WrappedKeyWire): Buffer {
	return Buffer.from(JSON.stringify(wire), "utf8");
}

function asDate(value: Date | string): Date {
	return value instanceof Date ? value : new Date(value);
}

function utf8FromBytea(value: Buffer | Uint8Array): string {
	return Buffer.from(value).toString("utf8");
}

function b64urlFromBytea(value: Buffer | Uint8Array): string {
	return Buffer.from(value).toString("base64url");
}

function bytesToWire(value: Buffer | Uint8Array): WrappedKeyWire {
	return JSON.parse(utf8FromBytea(value)) as WrappedKeyWire;
}

function parsePairingWrap(value: Buffer | Uint8Array): PairingWrapRequest {
	return pairingWrapRequestSchema.parse(JSON.parse(utf8FromBytea(value)));
}

function vaultFromUser(row: typeof users.$inferSelect): VaultRecord | null {
	if (
		!row.wrappedVaultRecovery ||
		!row.recoverySalt ||
		!row.recoveryVerifierHash ||
		!row.identityPub
	) {
		return null;
	}
	return {
		identityPub: row.identityPub as PublicJwk,
		wrappedVaultRecovery: bytesToWire(row.wrappedVaultRecovery),
		recoverySalt: row.recoverySalt.toString("base64url"),
		recoveryVerifierHash: row.recoveryVerifierHash,
	};
}
