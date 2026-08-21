import { sql } from "drizzle-orm";
import {
	bigint,
	bigserial,
	boolean,
	check,
	customType,
	index,
	inet,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	smallint,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

const citext = customType<{ data: string; driverData: string }>({
	dataType() {
		return "citext";
	},
});

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
	dataType() {
		return "bytea";
	},
});

export const userRole = pgEnum("user_role", ["admin", "member"]);
export const itemKind = pgEnum("item_kind", ["text", "link", "image", "file"]);
export const reqStatus = pgEnum("req_status", ["pending", "approved", "denied", "withdrawn"]);

export const users = pgTable("users", {
	id: uuid("id").primaryKey().defaultRandom(),
	handle: citext("handle").notNull().unique(),
	displayName: text("display_name").notNull(),
	role: userRole("role").notNull().default("member"),
	canUpload: boolean("can_upload").notNull().default(false),
	storageQuotaBytes: bigint("storage_quota_bytes", { mode: "number" }).notNull().default(0),
	storageUsedBytes: bigint("storage_used_bytes", { mode: "number" }).notNull().default(0),
	identityPub: jsonb("identity_pub"),
	wrappedVaultRecovery: bytea("wrapped_vault_recovery"),
	recoverySalt: bytea("recovery_salt"),
	recoveryVerifierHash: bytea("recovery_verifier_hash"),
	suspendedAt: timestamp("suspended_at", { withTimezone: true }),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const seats = pgTable(
	"seats",
	{
		seatNo: smallint("seat_no").primaryKey(),
		userId: uuid("user_id")
			.unique()
			.references(() => users.id, { onDelete: "set null" }),
		claimedAt: timestamp("claimed_at", { withTimezone: true }),
	},
	(table) => [check("seats_seat_no_range", sql`${table.seatNo} between 1 and 10`)],
);

export const devices = pgTable("devices", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	label: text("label").notNull(),
	platform: text("platform"),
	credentialId: bytea("credential_id").notNull().unique(),
	publicKey: bytea("public_key").notNull(),
	signCount: bigint("sign_count", { mode: "number" }).notNull().default(0),
	transports: text("transports").array(),
	aaguid: uuid("aaguid"),
	backedUp: boolean("backed_up"),
	lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
	revokedAt: timestamp("revoked_at", { withTimezone: true }),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
	tokenHash: bytea("token_hash").primaryKey(),
	deviceId: uuid("device_id")
		.notNull()
		.references(() => devices.id, { onDelete: "cascade" }),
	expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
	lastUsed: timestamp("last_used", { withTimezone: true }).notNull().defaultNow(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const invites = pgTable("invites", {
	id: uuid("id").primaryKey().defaultRandom(),
	tokenHash: bytea("token_hash").notNull().unique(),
	createdBy: uuid("created_by")
		.notNull()
		.references(() => users.id),
	note: text("note"),
	expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
	redeemedBy: uuid("redeemed_by").references(() => users.id),
	redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
	revokedAt: timestamp("revoked_at", { withTimezone: true }),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const blobs = pgTable("blobs", {
	id: uuid("id").primaryKey().defaultRandom(),
	ownerId: uuid("owner_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	r2Key: text("r2_key").notNull().unique(),
	byteSize: bigint("byte_size", { mode: "number" }).notNull(),
	chunkSize: integer("chunk_size").notNull(),
	chunkCount: integer("chunk_count").notNull(),
	sha256: bytea("sha256").notNull(),
	state: text("state").notNull().default("pending"),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	committedAt: timestamp("committed_at", { withTimezone: true }),
});

export const items = pgTable(
	"items",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		ownerId: uuid("owner_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		senderId: uuid("sender_id").references(() => users.id),
		kind: itemKind("kind").notNull(),
		ciphertext: bytea("ciphertext"),
		metaCiphertext: bytea("meta_ciphertext").notNull(),
		iv: bytea("iv").notNull(),
		wrappedKey: bytea("wrapped_key"),
		ephPub: jsonb("eph_pub"),
		blobId: uuid("blob_id").references(() => blobs.id, { onDelete: "set null" }),
		byteSize: bigint("byte_size", { mode: "number" }).notNull().default(0),
		pinned: boolean("pinned").notNull().default(false),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("items_owner_created_idx").on(table.ownerId, table.createdAt.desc()),
		index("items_expires_unpinned_idx").on(table.expiresAt).where(sql`${table.pinned} = false`),
	],
);

export const uploadRequests = pgTable(
	"upload_requests",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		reason: text("reason").notNull(),
		status: reqStatus("status").notNull().default("pending"),
		decidedBy: uuid("decided_by").references(() => users.id),
		decidedAt: timestamp("decided_at", { withTimezone: true }),
		decisionNote: text("decision_note"),
		grantedBytes: bigint("granted_bytes", { mode: "number" }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("one_pending_per_user").on(table.userId).where(sql`${table.status} = 'pending'`),
	],
);

export const pairingSessions = pgTable("pairing_sessions", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
	newDevicePub: jsonb("new_device_pub").notNull(),
	wrappedVault: bytea("wrapped_vault"),
	fingerprint: text("fingerprint").notNull().default(""),
	expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pushSubscriptions = pgTable("push_subscriptions", {
	id: uuid("id").primaryKey().defaultRandom(),
	deviceId: uuid("device_id")
		.notNull()
		.references(() => devices.id, { onDelete: "cascade" }),
	endpoint: text("endpoint").notNull().unique(),
	p256dh: text("p256dh").notNull(),
	auth: text("auth").notNull(),
});

export const auditLog = pgTable("audit_log", {
	id: bigserial("id", { mode: "number" }).primaryKey(),
	actorId: uuid("actor_id").references(() => users.id),
	action: text("action").notNull(),
	subjectType: text("subject_type"),
	subjectId: uuid("subject_id"),
	metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
	ip: inet("ip"),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
