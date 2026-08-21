import { randomUUID } from "node:crypto";
import { inviteState, seatNumbers } from "@meownow/db";
import type { ItemCreateRequest } from "@meownow/protocol";
import type { PairingRecord, StoredItem, VaultRecord, VaultStore } from "../vault/store";
import type {
	AdminEnrollCommit,
	AdminEnrollCommitResult,
	AuthStore,
	DeviceRow,
	DeviceWithUser,
	InviteRow,
	LoginCommit,
	RegistrationCommit,
	RegistrationCommitResult,
	SessionContext,
	SessionRow,
	UserRow,
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
	devices = new Map<string, DeviceRow>();
	sessions = new Map<string, SessionRow>();
	audit: Array<{ actorId: string | null; action: string }> = [];
	vaults = new Map<string, VaultRecord>();
	pairings = new Map<string, PairingRecord>();
	items: StoredItem[] = [];
	pushes: Array<{ deviceId: string; endpoint: string; p256dh: string; auth: string }> = [];

	constructor() {
		this.users.set(ADMIN_ID, {
			id: ADMIN_ID,
			handle: "rishi",
			displayName: "Rishi",
			role: "admin",
			canUpload: true,
			hasVault: false,
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
		const seat = this.seats
			.filter((row) => row.userId === null)
			.sort((a, b) => a.seatNo - b.seatNo)[0];
		if (!seat) {
			return "seats_full";
		}
		this.users.set(input.userId, {
			id: input.userId,
			handle: input.handle,
			displayName: input.displayName,
			role: "member",
			canUpload: false,
			hasVault: false,
			suspendedAt: null,
		});
		seat.userId = input.userId;
		seat.claimedAt = input.now;
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

	async insertAudit(input: { actorId: string | null; action: string }): Promise<void> {
		this.audit.push({ actorId: input.actorId, action: input.action });
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
	}

	async getPairing(id: string): Promise<PairingRecord | null> {
		return this.pairings.get(id) ?? null;
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
	}

	async createItem(ownerId: string, item: ItemCreateRequest, now: Date): Promise<void> {
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

	async addDeviceAndSession(input: {
		userId: string;
		now: Date;
		device: RegistrationCommit["device"];
		session: RegistrationCommit["session"];
	}): Promise<void> {
		this.addDevice(input.userId, input.device);
		this.addSession(input.device.id, input.session, input.now);
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
