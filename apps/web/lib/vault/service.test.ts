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
import { asPublicJwk } from "@meownow/protocol";
import { expect, test } from "vitest";
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
