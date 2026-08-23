import { randomUUID } from "node:crypto";
import { inviteState, seatNumbers } from "@meownow/db";
import type { ItemCreateRequest } from "@meownow/protocol";
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
	type DeviceRow,
	type DeviceWithUser,
	type InviteRow,
	type LoginCommit,
	type RegistrationCommit,
	type RegistrationCommitResult,
	type SessionContext,
	type SessionRow,
	type UserRow,
} from "./store";

type SeatRow = { seatNo: number; userId: string | null; claimedAt: Date | null };

const ADMIN_ID = "00000000-0000-4000-8000-000000000001";

export class MemoryAuthStore implements AuthStore, VaultStore {
	users = new Map<string, UserRow>();
	seats: SeatRow[] = seatNumbers().map((seatNo) => ({
		seatNo,
		userId: null,
		claimedAt: null,
	}));
	invites = new Map<string, InviteRow>();
	devices = new Map<string, DeviceRow & { lastSeenAt: Date | null; createdAt: Date }>();
	sessions = new Map<string, SessionRow>();
	audit: AuditEntry[] = [];
	vaults = new Map<string, VaultRecord>();
	pairings = new Map<string, PairingRecord>();
	pairingCodes = new Map<string, string>();
	items: StoredItem[] = [];
	pushes: Array<{ deviceId: string; endpoint: string; p256dh: string; auth: string }> = [];
	uploadRequests: UploadRequestRow[] = [];
	blobs: BlobRow[] = [];
	private auditSeq = 0;

	constructor() {
		this.users.set(ADMIN_ID, {
			id: ADMIN_ID,
			handle: "rishi",
			displayName: "Rishi",
			role: "admin",
			canUpload: true,
			hasVault: false,
			storageQuotaBytes: 524_288_000,
			storageUsedBytes: 0,
			suspendedAt: null,
		});
		const seat = this.seats[0];
		if (seat) {
			seat.userId = ADMIN_ID;
			seat.claimedAt = new Date("2026-01-01T00:00:00.000Z");
		}
	}

	async getInviteByTokenHash(hash: Buffer): Promise<InviteRow | null> {
		for (const invite of this.invites.values()) {
			if (invite.tokenHash.equals(hash)) {
				return invite;
			}
		}
		return null;
	}

	async getInviteById(id: string): Promise<InviteRow | null> {
		return this.invites.get(id) ?? null;
	}

	async listInvites(): Promise<InviteRow[]> {
		return [...this.invites.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
	}

	async handleTaken(handle: string): Promise<boolean> {
		return this.getUserByHandle(handle).then((user) => user !== null);
	}

	async getUserByHandle(handle: string): Promise<UserRow | null> {
		for (const user of this.users.values()) {
			if (user.handle.toLowerCase() === handle.toLowerCase()) {
				return user;
			}
		}
		return null;
	}

	async getUserById(id: string): Promise<UserRow | null> {
		return this.users.get(id) ?? null;
	}

	async countDevices(userId: string): Promise<number> {
		let count = 0;
		for (const device of this.devices.values()) {
			if (device.userId === userId) {
				count += 1;
			}
		}
		return count;
	}

	async getDeviceByCredentialId(credentialId: Buffer): Promise<DeviceWithUser | null> {
		for (const device of this.devices.values()) {
			if (device.credentialId.equals(credentialId)) {
				const user = this.users.get(device.userId);
				if (!user) {
					return null;
				}
				return { ...device, user };
			}
		}
		return null;
	}

	async getSessionByTokenHash(hash: Buffer): Promise<SessionContext | null> {
		const session = this.sessions.get(hash.toString("hex"));
		if (!session) {
			return null;
		}
		const device = this.devices.get(session.deviceId);
		if (!device) {
			return null;
		}
		const user = this.users.get(device.userId);
		if (!user) {
			return null;
		}
		return { session, device, user };
	}

	async createInvite(input: {
		createdBy: string;
		note: string | null;
		tokenHash: Buffer;
		expiresAt: Date;
		now: Date;
	}): Promise<{ id: string }> {
		const id = randomUUID();
		this.invites.set(id, {
			id,
			tokenHash: input.tokenHash,
			createdBy: input.createdBy,
			note: input.note,
			expiresAt: input.expiresAt,
			redeemedBy: null,
			redeemedAt: null,
			revokedAt: null,
			createdAt: input.now,
		});
		return { id };
	}

	async revokeInvite(id: string, now: Date): Promise<boolean> {
		const invite = this.invites.get(id);
		if (!invite || invite.redeemedAt) {
			return false;
		}
		invite.revokedAt = now;
		return true;
	}

	async completeRegistration(input: RegistrationCommit): Promise<RegistrationCommitResult> {
		const invite = await this.getInviteByTokenHash(input.inviteTokenHash);
		if (inviteState(invite, input.now) !== "ok" || !invite) {
			return "invite_invalid";
		}
		if (await this.handleTaken(input.handle)) {
			return "handle_taken";
		}
		this.users.set(input.userId, {
			id: input.userId,
			handle: input.handle,
			displayName: input.displayName,
			role: "member",
			canUpload: false,
			hasVault: false,
			storageQuotaBytes: 0,
			storageUsedBytes: 0,
			suspendedAt: null,
		});
		this.addDevice(input.userId, input.device);
		invite.redeemedBy = input.userId;
		invite.redeemedAt = input.now;
		this.addSession(input.device.id, input.session, input.now);
		return "ok";
	}

	async completeAdminEnroll(input: AdminEnrollCommit): Promise<AdminEnrollCommitResult> {
		if ((await this.countDevices(input.userId)) > 0) {
			return "admin_enrolled";
		}
		this.addDevice(input.userId, input.device);
		this.addSession(input.device.id, input.session, input.now);
		return "ok";
	}

	async completeLogin(input: LoginCommit): Promise<void> {
		const device = this.devices.get(input.deviceId);
		if (!device) {
			return;
		}
		device.signCount = input.signCount;
		device.lastSeenAt = input.now;
		this.addSession(input.deviceId, input.session, input.now);
	}

	async deleteSession(tokenHash: Buffer): Promise<void> {
		this.sessions.delete(tokenHash.toString("hex"));
	}

	async touchSession(tokenHash: Buffer, expiresAt: Date, now: Date): Promise<void> {
		const session = this.sessions.get(tokenHash.toString("hex"));
		if (!session) {
			return;
		}
		session.expiresAt = expiresAt;
		session.lastUsed = now;
	}

	async insertAudit(input: {
		actorId: string | null;
		action: string;
		subjectType: string | null;
		subjectId: string | null;
		now: Date;
	}): Promise<void> {
		this.auditSeq += 1;
		this.audit.push({
			id: this.auditSeq,
			actorId: input.actorId,
			action: input.action,
			subjectType: input.subjectType,
			subjectId: input.subjectId,
			createdAt: input.now,
		});
	}

	async listDirectory() {
		const users = [...this.users.values()]
			.sort((a, b) => a.handle.localeCompare(b.handle))
			.map((user) => ({
				...user,
				devices: [...this.devices.values()]
					.filter((device) => device.userId === user.id)
					.map((device) => ({
						id: device.id,
						userId: device.userId,
						label: device.label,
						revokedAt: device.revokedAt,
						lastSeenAt: device.lastSeenAt,
						createdAt: device.createdAt,
					})),
			}));
		return {
			users,
			seatsClaimed: users.length,
		};
	}

	async listAudit(): Promise<AuditEntry[]> {
		return [...this.audit].sort((a, b) => b.id - a.id);
	}

	async revokeDevice(id: string, now: Date): Promise<{ userId: string } | "missing" | "already"> {
		const device = this.devices.get(id);
		if (!device) {
			return "missing";
		}
		if (device.revokedAt) {
			return "already";
		}
		device.revokedAt = now;
		for (const [key, session] of this.sessions) {
			if (session.deviceId === id) {
				this.sessions.delete(key);
			}
		}
		return { userId: device.userId };
	}

	async removeUser(id: string): Promise<"ok" | "missing" | "last_admin"> {
		const user = this.users.get(id);
		if (!user) {
			return "missing";
		}
		if (user.role === "admin") {
			const others = [...this.users.values()].filter(
				(row) => row.role === "admin" && row.id !== id,
			);
			if (others.length === 0) {
				return "last_admin";
			}
		}
		this.users.delete(id);
		this.vaults.delete(id);
		for (const [deviceId, device] of this.devices) {
			if (device.userId === id) {
				this.devices.delete(deviceId);
				for (const [key, session] of this.sessions) {
					if (session.deviceId === deviceId) {
						this.sessions.delete(key);
					}
				}
			}
		}
		this.items = this.items.filter((item) => item.ownerId !== id);
		this.blobs = this.blobs.filter((blob) => blob.ownerId !== id);
		this.uploadRequests = this.uploadRequests.filter((row) => row.userId !== id);
		for (const row of this.uploadRequests) {
			if (row.decidedBy === id) {
				row.decidedBy = null;
			}
		}
		for (const [inviteId, invite] of this.invites) {
			if (invite.createdBy === id) {
				this.invites.delete(inviteId);
				continue;
			}
			if (invite.redeemedBy === id) {
				invite.redeemedBy = null;
			}
		}
		this.audit = this.audit.map((row) => (row.actorId === id ? { ...row, actorId: null } : row));
		for (const seat of this.seats) {
			if (seat.userId === id) {
				seat.userId = null;
				seat.claimedAt = null;
			}
		}
		return "ok";
	}

	async getVault(userId: string): Promise<VaultRecord | null> {
		return this.vaults.get(userId) ?? null;
	}

	async saveVault(userId: string, vault: VaultRecord): Promise<"ok" | "vault_exists"> {
		if (this.vaults.has(userId)) {
			return "vault_exists";
		}
		this.vaults.set(userId, vault);
		const user = this.users.get(userId);
		if (user) {
			user.hasVault = true;
		}
		return "ok";
	}

	async getVaultByHandle(handle: string): Promise<{ userId: string; vault: VaultRecord } | null> {
		const user = await this.getUserByHandle(handle);
		if (!user) {
			return null;
		}
		const vault = this.vaults.get(user.id);
		if (!vault) {
			return null;
		}
		return { userId: user.id, vault };
	}

	async createPairing(input: {
		id: string;
		code: string;
		publicJwk: PairingRecord["publicJwk"];
		expiresAt: Date;
		now: Date;
	}): Promise<void> {
		this.pairings.set(input.id, {
			id: input.id,
			userId: null,
			publicJwk: input.publicJwk,
			wrap: null,
			fingerprint: "",
			expiresAt: input.expiresAt,
			createdAt: input.now,
		});
		this.pairingCodes.set(input.code, input.id);
	}

	async getPairing(id: string): Promise<PairingRecord | null> {
		return this.pairings.get(id) ?? null;
	}

	async getPairingByCode(code: string): Promise<PairingRecord | null> {
		const id = this.pairingCodes.get(code);
		return id ? (this.pairings.get(id) ?? null) : null;
	}

	async savePairingWrap(input: {
		id: string;
		userId: string;
		wrap: NonNullable<PairingRecord["wrap"]>;
		now: Date;
	}): Promise<"ok" | "missing" | "complete"> {
		const row = this.pairings.get(input.id);
		if (!row) {
			return "missing";
		}
		if (row.wrap) {
			return "complete";
		}
		row.userId = input.userId;
		row.wrap = input.wrap;
		row.fingerprint = input.wrap.fingerprint;
		return "ok";
	}

	async deletePairing(id: string): Promise<void> {
		this.pairings.delete(id);
		for (const [code, pairingId] of this.pairingCodes) {
			if (pairingId === id) {
				this.pairingCodes.delete(code);
			}
		}
	}

	async createItem(ownerId: string, item: ItemCreateRequest, now: Date): Promise<void> {
		const existing = this.items.find((row) => row.id === item.id);
		if (existing) {
			if (existing.ownerId !== ownerId) {
				throw new AuthError("forbidden", 403);
			}
			return;
		}
		this.items.push({ ...item, ownerId, createdAt: now });
	}

	async listItems(ownerId: string): Promise<StoredItem[]> {
		return this.items
			.filter((item) => item.ownerId === ownerId)
			.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
	}

	async deleteItem(ownerId: string, id: string): Promise<boolean> {
		const before = this.items.length;
		this.items = this.items.filter((item) => !(item.ownerId === ownerId && item.id === id));
		return this.items.length < before;
	}

	async savePushSubscription(input: {
		deviceId: string;
		endpoint: string;
		p256dh: string;
		auth: string;
	}): Promise<void> {
		this.pushes = this.pushes.filter((row) => row.endpoint !== input.endpoint);
		this.pushes.push(input);
	}

	async listPushSubscriptions(
		userId: string,
		exceptDeviceId: string,
	): Promise<Array<{ endpoint: string; p256dh: string; auth: string }>> {
		return this.pushes.filter((row) => {
			const device = this.devices.get(row.deviceId);
			return device?.userId === userId && row.deviceId !== exceptDeviceId && !device.revokedAt;
		});
	}

	async deletePushSubscription(endpoint: string): Promise<void> {
		this.pushes = this.pushes.filter((row) => row.endpoint !== endpoint);
	}

	async createUploadRequest(input: {
		id: string;
		userId: string;
		reason: string;
		now: Date;
	}): Promise<"ok" | "pending"> {
		if (
			this.uploadRequests.some((row) => row.userId === input.userId && row.status === "pending")
		) {
			return "pending";
		}
		const user = this.users.get(input.userId);
		this.uploadRequests.push({
			id: input.id,
			userId: input.userId,
			handle: user?.handle ?? "",
			reason: input.reason,
			status: "pending",
			decidedBy: null,
			decidedAt: null,
			decisionNote: null,
			grantedBytes: null,
			createdAt: input.now,
		});
		return "ok";
	}

	async listUploadRequests(): Promise<UploadRequestRow[]> {
		return [...this.uploadRequests].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
	}

	async decideUploadRequest(input: {
		id: string;
		decidedBy: string;
		status: "approved" | "denied";
		grantedBytes: number | null;
		decisionNote: string | null;
		now: Date;
	}): Promise<"ok" | "missing" | "decided"> {
		const row = this.uploadRequests.find((item) => item.id === input.id);
		if (!row) {
			return "missing";
		}
		if (row.status !== "pending") {
			return "decided";
		}
		row.status = input.status;
		row.decidedBy = input.decidedBy;
		row.decidedAt = input.now;
		row.decisionNote = input.decisionNote;
		row.grantedBytes = input.grantedBytes;
		if (input.status === "approved" && input.grantedBytes) {
			const user = this.users.get(row.userId);
			if (user) {
				user.canUpload = true;
				user.storageQuotaBytes = input.grantedBytes;
			}
		}
		return "ok";
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
		this.blobs.push({
			...input,
			sha256: Buffer.alloc(32),
			state: "pending",
			createdAt: input.now,
			committedAt: null,
		});
	}

	async getBlob(id: string): Promise<BlobRow | null> {
		return this.blobs.find((row) => row.id === id) ?? null;
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
			wrappedKey: { iv: string; bytes: string };
			expiresAt: Date;
		};
		now: Date;
	}): Promise<"ok" | "quota"> {
		const user = this.users.get(input.blob.ownerId);
		if (!user) {
			return "quota";
		}
		if (user.storageUsedBytes + input.actualBytes > user.storageQuotaBytes) {
			return "quota";
		}
		const blob = this.blobs.find((row) => row.id === input.blob.id);
		if (blob?.state !== "pending") {
			return "quota";
		}
		blob.state = "committed";
		blob.byteSize = input.actualBytes;
		blob.sha256 = input.sha256;
		blob.committedAt = input.now;
		user.storageUsedBytes += input.actualBytes;
		this.items.push({
			id: input.item.id,
			kind: input.item.kind,
			metaCiphertext: input.item.metaCiphertext,
			iv: input.item.iv,
			wrappedKey: input.item.wrappedKey,
			blobId: blob.id,
			byteSize: input.actualBytes,
			expiresAt: input.item.expiresAt.toISOString(),
			ownerId: blob.ownerId,
			createdAt: input.now,
		});
		return "ok";
	}

	async addDeviceAndSession(input: {
		userId: string;
		now: Date;
		device: RegistrationCommit["device"];
		session: RegistrationCommit["session"];
	}): Promise<void> {
		this.addDevice(input.userId, input.device);
		this.addSession(input.device.id, input.session, input.now);
	}

	async usageSnapshot(): Promise<{
		committedBytes: number;
		pendingBytes: number;
		classAEstimate: number;
	}> {
		let committedBytes = 0;
		let pendingBytes = 0;
		let classAEstimate = 0;
		for (const blob of this.blobs) {
			classAEstimate += blob.chunkCount;
			if (blob.state === "committed") {
				committedBytes += blob.byteSize;
			} else {
				pendingBytes += blob.byteSize;
			}
		}
		return { committedBytes, pendingBytes, classAEstimate };
	}

	async prune(now: Date): Promise<{ keepR2Keys: string[]; deleteR2Keys: string[] }> {
		const plan = planPrune({
			now: now.getTime(),
			items: this.items.map((item) => ({
				id: item.id,
				pinned: false,
				expiresAt: Date.parse(item.expiresAt),
				blobId: item.blobId ?? null,
			})),
			blobs: this.blobs.map((blob) => ({
				id: blob.id,
				r2Key: blob.r2Key,
				state: blob.state,
				createdAt: blob.createdAt.getTime(),
				ownerId: blob.ownerId,
				byteSize: blob.byteSize,
			})),
			pairings: [...this.pairings.values()].map((row) => ({
				id: row.id,
				expiresAt: row.expiresAt.getTime(),
			})),
			sessions: [...this.sessions.entries()].map(([key, row]) => ({
				key,
				expiresAt: row.expiresAt.getTime(),
			})),
		});
		this.items = this.items.filter((item) => !plan.deleteItemIds.includes(item.id));
		for (const id of plan.deletePairingIds) {
			this.pairings.delete(id);
		}
		for (const key of plan.deleteSessionKeys) {
			this.sessions.delete(key);
		}
		this.blobs = this.blobs.filter((blob) => !plan.deleteBlobIds.includes(blob.id));
		for (const row of plan.decrementUsage) {
			const user = this.users.get(row.ownerId);
			if (user) {
				user.storageUsedBytes = Math.max(0, user.storageUsedBytes - row.bytes);
			}
		}
		return { keepR2Keys: plan.keepR2Keys, deleteR2Keys: plan.deleteR2Keys };
	}

	private addDevice(userId: string, device: RegistrationCommit["device"]): void {
		this.devices.set(device.id, {
			id: device.id,
			userId,
			label: device.label,
			credentialId: device.credentialId,
			publicKey: device.publicKey,
			signCount: device.signCount,
			transports: device.transports,
			revokedAt: null,
			lastSeenAt: null,
			createdAt: new Date(),
		});
	}

	private addSession(deviceId: string, session: RegistrationCommit["session"], now: Date): void {
		this.sessions.set(session.tokenHash.toString("hex"), {
			tokenHash: session.tokenHash,
			deviceId,
			expiresAt: session.expiresAt,
			createdAt: now,
			lastUsed: now,
		});
	}
}

export { ADMIN_ID };
