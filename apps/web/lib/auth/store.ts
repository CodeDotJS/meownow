import type { ErrorCode } from "@meownow/protocol";

export class AuthError extends Error {
	constructor(
		readonly code: ErrorCode,
		readonly status: number,
	) {
		super(code);
		this.name = "AuthError";
	}
}

export type UserRole = "admin" | "member";

export type UserRow = {
	id: string;
	handle: string;
	displayName: string;
	role: UserRole;
	canUpload: boolean;
	hasVault: boolean;
	storageQuotaBytes: number;
	storageUsedBytes: number;
	preserveNotes: boolean;
	suspendedAt: Date | null;
};

export type InviteRow = {
	id: string;
	tokenHash: Buffer;
	createdBy: string;
	note: string | null;
	expiresAt: Date;
	redeemedBy: string | null;
	redeemedAt: Date | null;
	revokedAt: Date | null;
	createdAt: Date;
};

export type InviteAskRow = {
	id: string;
	email: string;
	note: string;
	dismissedAt: Date | null;
	createdAt: Date;
};

export type DeviceRow = {
	id: string;
	userId: string;
	label: string;
	credentialId: Buffer;
	publicKey: Buffer;
	signCount: number;
	transports: string[] | null;
	revokedAt: Date | null;
};

export type DeviceWithUser = DeviceRow & { user: UserRow };

export type SessionRow = {
	tokenHash: Buffer;
	deviceId: string;
	expiresAt: Date;
	createdAt: Date;
	lastUsed: Date;
};

export type SessionContext = {
	session: SessionRow;
	device: DeviceRow;
	user: UserRow;
};

export type RegistrationCommit = {
	userId: string;
	handle: string;
	displayName: string;
	inviteTokenHash: Buffer;
	now: Date;
	device: {
		id: string;
		label: string;
		credentialId: Buffer;
		publicKey: Buffer;
		signCount: number;
		transports: string[] | null;
		aaguid: string | null;
		backedUp: boolean | null;
	};
	session: {
		tokenHash: Buffer;
		expiresAt: Date;
	};
};

export type AdminEnrollCommit = {
	userId: string;
	now: Date;
	device: RegistrationCommit["device"];
	session: RegistrationCommit["session"];
};

export type LoginCommit = {
	deviceId: string;
	signCount: number;
	now: Date;
	session: RegistrationCommit["session"];
};

export type RegistrationCommitResult = "ok" | "seats_full" | "handle_taken" | "invite_invalid";
export type AdminEnrollCommitResult = "ok" | "admin_enrolled";

export type DirectoryDevice = {
	id: string;
	userId: string;
	label: string;
	revokedAt: Date | null;
	lastSeenAt: Date | null;
	createdAt: Date;
};

export type DirectoryUser = UserRow & { devices: DirectoryDevice[] };

export type AuditEntry = {
	id: number;
	actorId: string | null;
	action: string;
	subjectType: string | null;
	subjectId: string | null;
	createdAt: Date;
};

export type AuthStore = {
	getInviteByTokenHash(hash: Buffer): Promise<InviteRow | null>;
	getInviteById(id: string): Promise<InviteRow | null>;
	listInvites(): Promise<InviteRow[]>;
	handleTaken(handle: string): Promise<boolean>;
	getUserByHandle(handle: string): Promise<UserRow | null>;
	getUserById(id: string): Promise<UserRow | null>;
	countDevices(userId: string): Promise<number>;
	getDeviceByCredentialId(credentialId: Buffer): Promise<DeviceWithUser | null>;
	getSessionByTokenHash(hash: Buffer): Promise<SessionContext | null>;
	createInvite(input: {
		createdBy: string;
		note: string | null;
		tokenHash: Buffer;
		expiresAt: Date;
		now: Date;
	}): Promise<{ id: string }>;
	revokeInvite(id: string, now: Date): Promise<boolean>;
	countOpenAsks(): Promise<number>;
	createAsk(input: { email: string; note: string; now: Date }): Promise<{ id: string }>;
	listOpenAsks(): Promise<InviteAskRow[]>;
	dismissAsk(id: string, now: Date): Promise<boolean>;
	completeRegistration(input: RegistrationCommit): Promise<RegistrationCommitResult>;
	completeAdminEnroll(input: AdminEnrollCommit): Promise<AdminEnrollCommitResult>;
	completeLogin(input: LoginCommit): Promise<void>;
	deleteSession(tokenHash: Buffer): Promise<void>;
	touchSession(tokenHash: Buffer, expiresAt: Date, now: Date): Promise<void>;
	insertAudit(input: {
		actorId: string | null;
		action: string;
		subjectType: string | null;
		subjectId: string | null;
		now: Date;
	}): Promise<void>;
	listDirectory(): Promise<{ users: DirectoryUser[]; seatsClaimed: number }>;
	listAudit(): Promise<AuditEntry[]>;
	revokeDevice(id: string, now: Date): Promise<{ userId: string } | "missing" | "already">;
	removeUser(id: string): Promise<"ok" | "missing" | "last_admin">;
};
