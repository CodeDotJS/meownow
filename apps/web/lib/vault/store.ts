import type {
	ItemCreateRequest,
	ItemRecord,
	PairingWrapRequest,
	PublicJwk,
	WrappedKeyWire,
} from "@meownow/protocol";
import type { RegistrationCommit } from "../auth/store";

export type VaultRecord = {
	identityPub: PublicJwk;
	wrappedVaultRecovery: WrappedKeyWire;
	recoverySalt: string;
	recoveryVerifierHash: Buffer;
};

export type PairingRecord = {
	id: string;
	userId: string | null;
	publicJwk: PublicJwk;
	wrap: PairingWrapRequest | null;
	fingerprint: string;
	expiresAt: Date;
	createdAt: Date;
};

export type StoredItem = Omit<ItemRecord, "createdAt"> & { ownerId: string; createdAt: Date };

export type UploadRequestRow = {
	id: string;
	userId: string;
	handle: string;
	reason: string;
	status: "pending" | "approved" | "denied" | "withdrawn";
	decidedBy: string | null;
	decidedAt: Date | null;
	decisionNote: string | null;
	grantedBytes: number | null;
	createdAt: Date;
};

export type BlobRow = {
	id: string;
	ownerId: string;
	r2Key: string;
	byteSize: number;
	chunkSize: number;
	chunkCount: number;
	sha256: Buffer;
	state: "pending" | "committed";
	createdAt: Date;
	committedAt: Date | null;
};

export type VaultStore = {
	getVault(userId: string): Promise<VaultRecord | null>;
	saveVault(userId: string, vault: VaultRecord): Promise<"ok" | "vault_exists">;
	getVaultByHandle(handle: string): Promise<{ userId: string; vault: VaultRecord } | null>;
	createPairing(input: {
		id: string;
		publicJwk: PublicJwk;
		expiresAt: Date;
		now: Date;
	}): Promise<void>;
	getPairing(id: string): Promise<PairingRecord | null>;
	savePairingWrap(input: {
		id: string;
		userId: string;
		wrap: PairingWrapRequest;
		now: Date;
	}): Promise<"ok" | "missing" | "complete">;
	deletePairing(id: string): Promise<void>;
	createItem(ownerId: string, item: ItemCreateRequest, now: Date): Promise<void>;
	listItems(ownerId: string): Promise<StoredItem[]>;
	deleteItem(ownerId: string, id: string): Promise<boolean>;
	savePushSubscription(input: {
		deviceId: string;
		endpoint: string;
		p256dh: string;
		auth: string;
	}): Promise<void>;
	listPushSubscriptions(
		userId: string,
		exceptDeviceId: string,
	): Promise<Array<{ endpoint: string; p256dh: string; auth: string }>>;
	deletePushSubscription(endpoint: string): Promise<void>;
	createUploadRequest(input: {
		id: string;
		userId: string;
		reason: string;
		now: Date;
	}): Promise<"ok" | "pending">;
	listUploadRequests(): Promise<UploadRequestRow[]>;
	decideUploadRequest(input: {
		id: string;
		decidedBy: string;
		status: "approved" | "denied";
		grantedBytes: number | null;
		decisionNote: string | null;
		now: Date;
	}): Promise<"ok" | "missing" | "decided">;
	createPendingBlob(input: {
		id: string;
		ownerId: string;
		r2Key: string;
		byteSize: number;
		chunkSize: number;
		chunkCount: number;
		now: Date;
	}): Promise<void>;
	getBlob(id: string): Promise<BlobRow | null>;
	commitBlobAndItem(input: {
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
	}): Promise<"ok" | "quota">;
	addDeviceAndSession(input: {
		userId: string;
		now: Date;
		device: RegistrationCommit["device"];
		session: RegistrationCommit["session"];
	}): Promise<void>;
};
