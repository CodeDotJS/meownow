import type { WebEnv } from "@meownow/config/env";
import {
	ARGON2_TEST,
	createVault,
	decrypt,
	encrypt,
	fingerprintSharedSecret,
	generateIdentityKeyPair,
	generatePairingKeyPair,
	generateVaultKey,
	publicJwk,
	recoveryVerifier,
	unwrapExtractableForPairing,
	unwrapIdentityKey,
	unwrapVaultFromPairing,
	wrapExtractableForDevice,
	wrapIdentityKey,
	wrapVaultForPairing,
} from "@meownow/crypto";
import {
	asPublicJwk,
	generateCapabilityKeyPair,
	R2_STORAGE_CEILING_BYTES,
} from "@meownow/protocol";
import { expect, test } from "vitest";
import { createHandlers } from "../auth/handlers";
import { MemoryAuthStore } from "../auth/memory-store";
import { AuthService } from "../auth/service";
import type { WebAuthnPort } from "../auth/webauthn";
import { VaultService } from "./service";

const env: WebEnv = {
	DATABASE_URL: "postgresql://user:pass@localhost:5432/meownow",
	APP_URL: "https://meownow.example",
	SESSION_SECRET: "0".repeat(32),
	ADMIN_ENROLL_SECRET: "admin-enroll-secret",
};

const dummyAttestation = {
	id: "YQ",
	rawId: "YQ",
	type: "public-key" as const,
	response: { clientDataJSON: "e30", attestationObject: "e30" },
	clientExtensionResults: {},
};

function mockWebAuthn(): WebAuthnPort {
	let n = 0;
	return {
		generateRegistrationOptions: async () => {
			n += 1;
			return {
				challenge: `reg-${n}`,
				rp: { name: "meownow", id: "meownow.example" },
				user: { id: "AA", name: "u", displayName: "U" },
				pubKeyCredParams: [{ alg: -7, type: "public-key" }],
				timeout: 60_000,
				attestation: "none",
			};
		},
		verifyRegistrationResponse: async () => ({
			verified: true,
			registrationInfo: {
				credential: {
					id: Buffer.from(`cred-${n}`).toString("base64url"),
					publicKey: new Uint8Array([1, 2, 3, 4]),
					counter: 0,
					transports: ["internal"],
				},
				credentialBackedUp: false,
			},
		}),
		generateAuthenticationOptions: async () => ({
			challenge: "login-chal",
			timeout: 60_000,
			rpId: "meownow.example",
			userVerification: "required",
		}),
		verifyAuthenticationResponse: async () => ({
			verified: true,
			authenticationInfo: { newCounter: 1 },
		}),
	};
}

function wire(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString("base64url");
}

test("second device decrypts an item created on the first after fingerprint-confirmed pairing", async () => {
	const store = new MemoryAuthStore();
	const webauthn = mockWebAuthn();
	const auth = new AuthService({ env, store, webauthn });
	const vaultApi = new VaultService({ env, auth: store, vault: store, webauthn });
	const { challenge } = await auth.adminEnrollOptions({
		handle: "rishi",
		secret: env.ADMIN_ENROLL_SECRET,
		deviceLabel: "one",
	});
	const enrolled = await auth.adminEnrollVerify(dummyAttestation, challenge);

	const vault = await createVault({ argon2: ARGON2_TEST });
	const identity = await generateIdentityKeyPair();
	const deviceKey = await generateVaultKey();
	const wrappedExtractable = await wrapExtractableForDevice(deviceKey, vault.extractableVaultKey);
	const wrappedIdentity = await wrapIdentityKey(vault.vaultKey, identity.privateKey);
	const verifier = await recoveryVerifier(vault.mnemonic, vault.recoverySalt, ARGON2_TEST);
	await vaultApi.putVault(enrolled.sessionToken, {
		identityPub: asPublicJwk(await publicJwk(identity.publicKey)),
		wrappedVaultRecovery: {
			iv: wire(vault.wrappedVaultRecovery.iv),
			bytes: wire(vault.wrappedVaultRecovery.bytes),
		},
		recoverySalt: wire(vault.recoverySalt),
		recoveryVerifier: wire(verifier),
	});

	const itemId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
	const aad = { itemId, kind: "text" as const };
	const sealed = await encrypt(vault.vaultKey, new TextEncoder().encode("from device one"), aad);
	await vaultApi.createItem(enrolled.sessionToken, {
		id: itemId,
		kind: "text",
		ciphertext: wire(sealed.bytes),
		metaCiphertext: wire(
			(await encrypt(vault.vaultKey, new TextEncoder().encode("{}"), aad)).bytes,
		),
		iv: wire(sealed.iv),
		byteSize: sealed.bytes.byteLength,
		expiresAt: new Date(Date.now() + 86400000).toISOString(),
	});

	const newDevice = await generatePairingKeyPair();
	const started = await vaultApi.startPairing(asPublicJwk(await publicJwk(newDevice.publicKey)));
	const extractable = await unwrapExtractableForPairing(deviceKey, wrappedExtractable);
	const wrap = await wrapVaultForPairing(extractable, await publicJwk(newDevice.publicKey));
	const newFp = await fingerprintSharedSecret(newDevice.privateKey, wrap.ephPublicJwk);
	expect(newFp).toBe(wrap.fingerprint);

	await vaultApi.postWrap(enrolled.sessionToken, started.id, {
		fingerprint: wrap.fingerprint,
		vaultWrap: {
			iv: wire(wrap.iv),
			bytes: wire(wrap.bytes),
			ephPublicJwk: asPublicJwk(wrap.ephPublicJwk),
		},
		identityWrap: { iv: wire(wrappedIdentity.iv), bytes: wire(wrappedIdentity.bytes) },
		identityPub: asPublicJwk(await publicJwk(identity.publicKey)),
	});

	const polled = await vaultApi.getPairing(started.id);
	expect(polled.wrap?.fingerprint).toBe(newFp);
	if (!polled.wrap) {
		throw new Error("missing wrap");
	}
	const imported = await unwrapVaultFromPairing(newDevice.privateKey, {
		iv: Buffer.from(polled.wrap.vaultWrap.iv, "base64url"),
		bytes: Buffer.from(polled.wrap.vaultWrap.bytes, "base64url"),
		ephPublicJwk: polled.wrap.vaultWrap.ephPublicJwk,
		fingerprint: polled.wrap.fingerprint,
	});
	await unwrapIdentityKey(imported, {
		iv: Buffer.from(polled.wrap.identityWrap.iv, "base64url"),
		bytes: Buffer.from(polled.wrap.identityWrap.bytes, "base64url"),
	});

	const listed = await vaultApi.listItems(enrolled.sessionToken);
	const remote = listed.items[0];
	if (!remote) {
		throw new Error("missing item");
	}
	if (!remote.ciphertext) {
		throw new Error("missing ciphertext");
	}
	const opened = await decrypt(
		imported,
		{
			iv: Buffer.from(remote.iv, "base64url"),
			bytes: Buffer.from(remote.ciphertext, "base64url"),
		},
		{ itemId: remote.id, kind: remote.kind },
	);
	expect(new TextDecoder().decode(opened)).toBe("from device one");
});

test("unauthenticated wrap and item create are denied", async () => {
	const store = new MemoryAuthStore();
	const vaultApi = new VaultService({ env, auth: store, vault: store, webauthn: mockWebAuthn() });
	const newDevice = await generatePairingKeyPair();
	const started = await vaultApi.startPairing(asPublicJwk(await publicJwk(newDevice.publicKey)));
	await expect(
		vaultApi.postWrap(undefined, started.id, {
			fingerprint: "000000",
			vaultWrap: {
				iv: "YQ",
				bytes: "YQ",
				ephPublicJwk: asPublicJwk(await publicJwk(newDevice.publicKey)),
			},
			identityWrap: { iv: "YQ", bytes: "YQ" },
			identityPub: asPublicJwk(await publicJwk(newDevice.publicKey)),
		}),
	).rejects.toMatchObject({ code: "unauthorized" });
	await expect(
		vaultApi.createItem(undefined, {
			id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
			kind: "text",
			ciphertext: "YQ",
			metaCiphertext: "YQ",
			iv: "YQ",
			byteSize: 1,
			expiresAt: new Date().toISOString(),
		}),
	).rejects.toMatchObject({ code: "unauthorized" });
});

test("signed-in device looks up a pairing session by code", async () => {
	const store = new MemoryAuthStore();
	const webauthn = mockWebAuthn();
	const auth = new AuthService({ env, store, webauthn });
	const vaultApi = new VaultService({ env, auth: store, vault: store, webauthn });
	const { challenge } = await auth.adminEnrollOptions({
		handle: "rishi",
		secret: env.ADMIN_ENROLL_SECRET,
		deviceLabel: "one",
	});
	const enrolled = await auth.adminEnrollVerify(dummyAttestation, challenge);
	const newDevice = await generatePairingKeyPair();
	const started = await vaultApi.startPairing(asPublicJwk(await publicJwk(newDevice.publicKey)));
	expect(started.code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{8}$/);
	const found = await vaultApi.lookupPairing(enrolled.sessionToken, started.code);
	expect(found.id).toBe(started.id);
	expect(found.publicJwk.x).toBe((await publicJwk(newDevice.publicKey)).x);
	await expect(vaultApi.lookupPairing(undefined, started.code)).rejects.toMatchObject({
		code: "unauthorized",
	});
	await expect(vaultApi.lookupPairing(enrolled.sessionToken, "22222222")).rejects.toMatchObject({
		code: "pairing_missing",
	});
});

test("wrong recovery verifier cannot enroll a device", async () => {
	const store = new MemoryAuthStore();
	const webauthn = mockWebAuthn();
	const auth = new AuthService({ env, store, webauthn });
	const vaultApi = new VaultService({ env, auth: store, vault: store, webauthn });
	const { challenge } = await auth.adminEnrollOptions({
		handle: "rishi",
		secret: env.ADMIN_ENROLL_SECRET,
		deviceLabel: "one",
	});
	const enrolled = await auth.adminEnrollVerify(dummyAttestation, challenge);
	const vault = await createVault({ argon2: ARGON2_TEST });
	const identity = await generateIdentityKeyPair();
	const verifier = await recoveryVerifier(vault.mnemonic, vault.recoverySalt, ARGON2_TEST);
	await vaultApi.putVault(enrolled.sessionToken, {
		identityPub: asPublicJwk(await publicJwk(identity.publicKey)),
		wrappedVaultRecovery: {
			iv: wire(vault.wrappedVaultRecovery.iv),
			bytes: wire(vault.wrappedVaultRecovery.bytes),
		},
		recoverySalt: wire(vault.recoverySalt),
		recoveryVerifier: wire(verifier),
	});
	await expect(
		vaultApi.recoveryRegisterOptions({
			handle: "rishi",
			verifier: wire(new Uint8Array(32)),
			deviceLabel: "lost",
		}),
	).rejects.toMatchObject({ code: "recovery_invalid" });
});

test("createItem fans out ciphertext to every hub subscriber", async () => {
	const store = new MemoryAuthStore();
	const webauthn = mockWebAuthn();
	const auth = new AuthService({ env, store, webauthn });
	const received: unknown[] = [];
	const vaultApi = new VaultService({
		env,
		auth: store,
		vault: store,
		webauthn,
		hub: {
			publish: async (_userId, envelope) => {
				received.push(envelope);
			},
		},
	});
	const { challenge } = await auth.adminEnrollOptions({
		handle: "rishi",
		secret: env.ADMIN_ENROLL_SECRET,
		deviceLabel: "one",
	});
	const enrolled = await auth.adminEnrollVerify(dummyAttestation, challenge);
	const vault = await createVault({ argon2: ARGON2_TEST });
	const identity = await generateIdentityKeyPair();
	await vaultApi.putVault(enrolled.sessionToken, {
		identityPub: asPublicJwk(await publicJwk(identity.publicKey)),
		wrappedVaultRecovery: {
			iv: wire(vault.wrappedVaultRecovery.iv),
			bytes: wire(vault.wrappedVaultRecovery.bytes),
		},
		recoverySalt: wire(vault.recoverySalt),
		recoveryVerifier: wire(await recoveryVerifier(vault.mnemonic, vault.recoverySalt, ARGON2_TEST)),
	});
	const itemId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
	await vaultApi.createItem(enrolled.sessionToken, {
		id: itemId,
		kind: "text",
		ciphertext: wire(new Uint8Array([1, 2, 3])),
		metaCiphertext: wire(new Uint8Array([4])),
		iv: wire(new Uint8Array(12)),
		byteSize: 3,
		expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
	});
	expect(received).toHaveLength(1);
	expect(received[0]).toMatchObject({
		type: "item.created",
		item: { id: itemId, ciphertext: wire(new Uint8Array([1, 2, 3])) },
	});
});

test("expired and oversized items are denied or omitted", async () => {
	const store = new MemoryAuthStore();
	const webauthn = mockWebAuthn();
	let now = new Date("2026-08-22T00:00:00.000Z");
	const auth = new AuthService({ env, store, webauthn, now: () => now });
	const vaultApi = new VaultService({ env, auth: store, vault: store, webauthn, now: () => now });
	const { challenge } = await auth.adminEnrollOptions({
		handle: "rishi",
		secret: env.ADMIN_ENROLL_SECRET,
		deviceLabel: "one",
	});
	const enrolled = await auth.adminEnrollVerify(dummyAttestation, challenge);
	const vault = await createVault({ argon2: ARGON2_TEST });
	const identity = await generateIdentityKeyPair();
	await vaultApi.putVault(enrolled.sessionToken, {
		identityPub: asPublicJwk(await publicJwk(identity.publicKey)),
		wrappedVaultRecovery: {
			iv: wire(vault.wrappedVaultRecovery.iv),
			bytes: wire(vault.wrappedVaultRecovery.bytes),
		},
		recoverySalt: wire(vault.recoverySalt),
		recoveryVerifier: wire(await recoveryVerifier(vault.mnemonic, vault.recoverySalt, ARGON2_TEST)),
	});
	await expect(
		vaultApi.createItem(enrolled.sessionToken, {
			id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
			kind: "text",
			ciphertext: wire(new Uint8Array(65_536 + 17)),
			metaCiphertext: "YQ",
			iv: "YQ",
			byteSize: 1,
			expiresAt: new Date(now.getTime() + 86_400_000).toISOString(),
		}),
	).rejects.toMatchObject({ code: "item_invalid" });
	const id = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
	await vaultApi.createItem(enrolled.sessionToken, {
		id,
		kind: "text",
		ciphertext: "YQ",
		metaCiphertext: "YQ",
		iv: "YQ",
		byteSize: 1,
		expiresAt: new Date(now.getTime() + 1_000).toISOString(),
	});
	now = new Date(now.getTime() + 2_000);
	const listed = await vaultApi.listItems(enrolled.sessionToken);
	expect(listed.items).toEqual([]);
});

test("createItem push payload is a name only and skips the sending device", async () => {
	const store = new MemoryAuthStore();
	const webauthn = mockWebAuthn();
	const notices: Array<{ exceptDeviceId: string; title: string }> = [];
	const auth = new AuthService({ env, store, webauthn });
	const vaultApi = new VaultService({
		env,
		auth: store,
		vault: store,
		webauthn,
		push: {
			notify: async (input) => {
				notices.push({ exceptDeviceId: input.exceptDeviceId, title: input.title });
			},
		},
	});
	const { challenge } = await auth.adminEnrollOptions({
		handle: "rishi",
		secret: env.ADMIN_ENROLL_SECRET,
		deviceLabel: "one",
	});
	const enrolled = await auth.adminEnrollVerify(dummyAttestation, challenge);
	const vault = await createVault({ argon2: ARGON2_TEST });
	const identity = await generateIdentityKeyPair();
	await vaultApi.putVault(enrolled.sessionToken, {
		identityPub: asPublicJwk(await publicJwk(identity.publicKey)),
		wrappedVaultRecovery: {
			iv: wire(vault.wrappedVaultRecovery.iv),
			bytes: wire(vault.wrappedVaultRecovery.bytes),
		},
		recoverySalt: wire(vault.recoverySalt),
		recoveryVerifier: wire(await recoveryVerifier(vault.mnemonic, vault.recoverySalt, ARGON2_TEST)),
	});
	const ciphertext = wire(new Uint8Array([9, 9, 9]));
	await vaultApi.createItem(enrolled.sessionToken, {
		id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
		kind: "text",
		ciphertext,
		metaCiphertext: "YQ",
		iv: "YQ",
		byteSize: 3,
		expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
	});
	const sender = [...store.devices.values()][0];
	expect(notices).toEqual([{ exceptDeviceId: sender?.id, title: "New item from Rishi" }]);
	expect(JSON.stringify(notices)).not.toContain(ciphertext);
});

test("push subscribe without a session is denied", async () => {
	const store = new MemoryAuthStore();
	const vaultApi = new VaultService({
		env: { ...env, VAPID_PUBLIC_KEY: "vapid-public" },
		auth: store,
		vault: store,
		webauthn: mockWebAuthn(),
	});
	await expect(
		vaultApi.subscribePush(undefined, {
			endpoint: "https://push.example/sub",
			keys: { p256dh: "p", auth: "a" },
		}),
	).rejects.toMatchObject({ code: "unauthorized" });
});

test("deleteItem without a session is denied", async () => {
	const store = new MemoryAuthStore();
	const vaultApi = new VaultService({ env, auth: store, vault: store, webauthn: mockWebAuthn() });
	await expect(
		vaultApi.deleteItem(undefined, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
	).rejects.toMatchObject({
		code: "unauthorized",
	});
});

test("upload intent is denied when can_upload is false", async () => {
	const store = new MemoryAuthStore();
	const webauthn = mockWebAuthn();
	const auth = new AuthService({ env, store, webauthn });
	const vaultApi = new VaultService({
		env: { ...env, EDGE_URL: "https://edge.example", CAPABILITY_TOKEN_PRIVATE_KEY: "x" },
		auth: store,
		vault: store,
		webauthn,
	});
	const { challenge } = await auth.adminEnrollOptions({
		handle: "rishi",
		secret: env.ADMIN_ENROLL_SECRET,
		deviceLabel: "one",
	});
	const enrolled = await auth.adminEnrollVerify(dummyAttestation, challenge);
	const user = [...store.users.values()][0];
	if (user) {
		user.canUpload = false;
	}
	await expect(
		vaultApi.uploadIntent(enrolled.sessionToken, { kind: "file", byteSize: 32, chunkCount: 1 }),
	).rejects.toMatchObject({ code: "forbidden" });
});

test("approved user gets a server-generated R2 key and cannot pick one", async () => {
	const keys = await generateCapabilityKeyPair();
	const store = new MemoryAuthStore();
	const webauthn = mockWebAuthn();
	const auth = new AuthService({ env, store, webauthn });
	const vaultApi = new VaultService({
		env: {
			...env,
			EDGE_URL: "https://edge.example",
			CAPABILITY_TOKEN_PRIVATE_KEY: JSON.stringify(keys.privateJwk),
		},
		auth: store,
		vault: store,
		webauthn,
	});
	const { challenge } = await auth.adminEnrollOptions({
		handle: "rishi",
		secret: env.ADMIN_ENROLL_SECRET,
		deviceLabel: "one",
	});
	const enrolled = await auth.adminEnrollVerify(dummyAttestation, challenge);
	const intent = await vaultApi.uploadIntent(enrolled.sessionToken, {
		kind: "file",
		byteSize: 32,
		chunkCount: 1,
	});
	expect(intent.r2Key).toMatch(
		/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
	);
	const ticket = await vaultApi.uploadTicket(enrolled.sessionToken, {
		blobId: intent.blobId,
		purpose: "upload",
	});
	expect(ticket.token.split(".")).toHaveLength(3);
});

test("admin usage shows committed R2 bytes against the 10 GiB ceiling; members are forbidden", async () => {
	const store = new MemoryAuthStore();
	const webauthn = mockWebAuthn();
	const auth = new AuthService({ env, store, webauthn });
	const vaultApi = new VaultService({ env, auth: store, vault: store, webauthn });
	const { challenge } = await auth.adminEnrollOptions({
		handle: "rishi",
		secret: env.ADMIN_ENROLL_SECRET,
		deviceLabel: "one",
	});
	const enrolled = await auth.adminEnrollVerify(dummyAttestation, challenge);
	const ownerId = [...store.users.values()][0]?.id ?? "";
	store.blobs.push({
		id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
		ownerId,
		r2Key: "r2-a",
		byteSize: 2048,
		chunkSize: 1024,
		chunkCount: 2,
		sha256: Buffer.alloc(32),
		state: "committed",
		createdAt: new Date(),
		committedAt: new Date(),
	});
	store.blobs.push({
		id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
		ownerId,
		r2Key: "r2-b",
		byteSize: 512,
		chunkSize: 512,
		chunkCount: 1,
		sha256: Buffer.alloc(32),
		state: "pending",
		createdAt: new Date(),
		committedAt: null,
	});
	const usage = await vaultApi.adminUsage(enrolled.sessionToken);
	expect(usage.r2CommittedBytes).toBe(2048);
	expect(usage.r2PendingBytes).toBe(512);
	expect(usage.r2CeilingBytes).toBe(R2_STORAGE_CEILING_BYTES);
	expect(usage.classAEstimate).toBe(3);
	expect(usage.classBCounted).toBe(false);
	expect(usage.r2CommittedBytes).toBeLessThan(usage.r2CeilingBytes);

	const invite = await auth.createInvite(enrolled.sessionToken, undefined);
	const { challenge: join } = await auth.registerOptions({
		token: invite.token,
		handle: "ada",
		displayName: "Ada",
		deviceLabel: "phone",
	});
	const member = await auth.registerVerify(dummyAttestation, join);
	await expect(vaultApi.adminUsage(member.sessionToken)).rejects.toMatchObject({
		code: "forbidden",
		status: 403,
	});

	const handlers = createHandlers({ env, store, webauthn });
	const denied = await handlers.getAdminUsage(
		new Request("https://meownow.example/api/admin/usage", {
			headers: { cookie: `sid=${member.sessionToken}` },
		}),
	);
	expect(denied.status).toBe(403);
	expect(await denied.json()).toEqual({ error: "forbidden" });
});

test("createItem is denied when the send bucket is empty", async () => {
	const store = new MemoryAuthStore();
	const webauthn = mockWebAuthn();
	const auth = new AuthService({ env, store, webauthn });
	const vaultApi = new VaultService({
		env,
		auth: store,
		vault: store,
		webauthn,
		limits: { take: async () => false },
	});
	const { challenge } = await auth.adminEnrollOptions({
		handle: "rishi",
		secret: env.ADMIN_ENROLL_SECRET,
		deviceLabel: "one",
	});
	const enrolled = await auth.adminEnrollVerify(dummyAttestation, challenge);
	const user = [...store.users.values()][0];
	if (user) {
		user.hasVault = true;
	}
	await expect(
		vaultApi.createItem(enrolled.sessionToken, {
			id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
			kind: "text",
			ciphertext: "YQ",
			metaCiphertext: "YQ",
			iv: "YQ",
			byteSize: 1,
			expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
		}),
	).rejects.toMatchObject({ code: "rate_limited", status: 429 });
});

test("prune removes expired items and stale pending blobs", async () => {
	const store = new MemoryAuthStore();
	const now = new Date("2026-08-22T04:00:00.000Z");
	const vaultApi = new VaultService({ env, auth: store, vault: store, now: () => now });
	const ownerId = [...store.users.values()][0]?.id ?? "";
	store.items.push({
		id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
		kind: "text",
		ciphertext: "YQ",
		metaCiphertext: "YQ",
		iv: "YQ",
		byteSize: 1,
		expiresAt: new Date(now.getTime() - 1).toISOString(),
		ownerId,
		createdAt: now,
	});
	store.blobs.push({
		id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
		ownerId,
		r2Key: "stale-pending",
		byteSize: 4,
		chunkSize: 4,
		chunkCount: 1,
		sha256: Buffer.alloc(32),
		state: "pending",
		createdAt: new Date(now.getTime() - 60 * 60 * 1000),
		committedAt: null,
	});
	const result = await vaultApi.prune();
	expect(store.items).toEqual([]);
	expect(result.deleteR2Keys).toContain("stale-pending");
	expect(store.blobs).toEqual([]);
});
