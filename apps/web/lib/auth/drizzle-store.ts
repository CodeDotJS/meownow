import {
	type AppDatabase,
	auditLog,
	claimSeat,
	createDb,
	createPool,
	devices,
	inviteState,
	invites,
	sessions,
	users,
} from "@meownow/db";
import { eq } from "drizzle-orm";
import type {
	AdminEnrollCommit,
	AdminEnrollCommitResult,
	AuthStore,
	DeviceWithUser,
	InviteRow,
	LoginCommit,
	RegistrationCommit,
	RegistrationCommitResult,
	SessionContext,
	UserRow,
} from "./store";

type DbTx = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

function mapUser(row: typeof users.$inferSelect): UserRow {
	return {
		id: row.id,
		handle: row.handle,
		displayName: row.displayName,
		role: row.role,
		canUpload: row.canUpload,
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

export class DrizzleAuthStore implements AuthStore {
	constructor(private readonly connectionString: string) {}

	private async withDb<T>(fn: (db: AppDatabase) => Promise<T>): Promise<T> {
		const pool = createPool(this.connectionString);
		const db = createDb(pool);
		try {
			return await fn(db);
		} finally {
			await pool.end();
		}
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

	async completeRegistration(input: RegistrationCommit): Promise<RegistrationCommitResult> {
		return this.withDb(async (db) => {
			try {
				return await db.transaction(async (tx) => {
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
					const seatNo = await claimSeat(tx, input.userId);
					if (seatNo === null) {
						throw new SeatFullRollback();
					}
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
			} catch (err) {
				if (err instanceof SeatFullRollback) {
					return "seats_full";
				}
				throw err;
			}
		});
	}

	async completeAdminEnroll(input: AdminEnrollCommit): Promise<AdminEnrollCommitResult> {
		return this.withDb((db) =>
			db.transaction(async (tx) => {
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
			}),
		);
	}

	async completeLogin(input: LoginCommit): Promise<void> {
		await this.withDb((db) =>
			db.transaction(async (tx) => {
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
			}),
		);
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
}

class SeatFullRollback extends Error {
	constructor() {
		super("seats_full");
		this.name = "SeatFullRollback";
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
