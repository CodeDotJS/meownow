import type {
	ItemCreateRequest,
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

export type StoredItem = ItemCreateRequest & { ownerId: string; createdAt: Date };

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
	addDeviceAndSession(input: {
		userId: string;
		now: Date;
		device: RegistrationCommit["device"];
		session: RegistrationCommit["session"];
	}): Promise<void>;
};
