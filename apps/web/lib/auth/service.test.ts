import type { WebEnv } from "@meownow/config/env";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { expect, test } from "vitest";
import { createHandlers } from "./handlers";
import { MemoryAuthStore } from "./memory-store";
import { AuthService } from "./service";
import type { WebAuthnPort } from "./webauthn";

const env: WebEnv = {
	DATABASE_URL: "postgresql://user:pass@localhost:5432/meownow",
	APP_URL: "https://meownow.example",
	SESSION_SECRET: "0".repeat(32),
	ADMIN_ENROLL_SECRET: "admin-enroll-secret",
};

const dummyAttestation: RegistrationResponseJSON = {
	id: "YQ",
	rawId: "YQ",
	type: "public-key",
	response: {
		clientDataJSON: "e30",
		attestationObject: "e30",
	},
	clientExtensionResults: {},
};

const dummyAssertion: AuthenticationResponseJSON = {
	id: "YQ",
	rawId: "YQ",
	type: "public-key",
	response: {
		clientDataJSON: "e30",
		authenticatorData: "e30",
		signature: "e30",
	},
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
				fmt: "none",
				aaguid: "00000000-0000-0000-0000-000000000000",
				credentialType: "public-key",
				credential: {
					id: Buffer.from(`cred-${n}`).toString("base64url"),
					publicKey: new Uint8Array([1, 2, 3, 4]),
					counter: 0,
					transports: ["internal"],
				},
				credentialDeviceType: "singleDevice",
				credentialBackedUp: false,
				userVerified: true,
				origin: "https://meownow.example",
				rpID: "meownow.example",
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
			authenticationInfo: {
				credentialID: "cred",
				newCounter: 1,
				userVerified: true,
				credentialDeviceType: "singleDevice",
				credentialBackedUp: false,
				origin: "https://meownow.example",
				rpID: "meownow.example",
			},
		}),
	};
}

async function enrollAdmin(auth: AuthService) {
	const { challenge } = await auth.adminEnrollOptions({
		handle: "rishi",
		secret: env.ADMIN_ENROLL_SECRET,
		deviceLabel: "admin laptop",
	});
	return auth.adminEnrollVerify(dummyAttestation, challenge);
}

async function signupMember(auth: AuthService, adminToken: string, handle: string) {
	const invite = await auth.createInvite(adminToken, undefined);
	const { challenge } = await auth.registerOptions({
		token: invite.token,
		handle,
		displayName: handle,
		deviceLabel: "laptop",
	});
	return { invite, result: await auth.registerVerify(dummyAttestation, challenge) };
}

test("invite token is shown once; only the hash is stored", async () => {
	const store = new MemoryAuthStore();
	const auth = new AuthService({ env, store, webauthn: mockWebAuthn() });
	const { sessionToken } = await enrollAdmin(auth);
	const created = await auth.createInvite(sessionToken, "ada");
	expect(created.token).toMatch(/^[A-Za-z0-9_-]+$/);
	const stored = [...store.invites.values()][0];
	expect(stored?.note).toBe("ada");
	expect(stored?.tokenHash.equals(Buffer.from(created.token))).toBe(false);
	expect(created.token.includes(stored?.tokenHash.toString("hex") ?? "never")).toBe(false);
});

test("expired, revoked, and redeemed invites are rejected", async () => {
	const store = new MemoryAuthStore();
	let now = new Date("2026-08-22T00:00:00.000Z");
	const auth = new AuthService({ env, store, webauthn: mockWebAuthn(), now: () => now });
	const { sessionToken } = await enrollAdmin(auth);
	const invite = await auth.createInvite(sessionToken, undefined);

	now = new Date(now.getTime() + 73 * 60 * 60 * 1000);
	await expect(
		auth.registerOptions({
			token: invite.token,
			handle: "ada",
			displayName: "Ada",
			deviceLabel: "laptop",
		}),
	).rejects.toMatchObject({ code: "invite_expired" });

	now = new Date("2026-08-22T00:00:00.000Z");
	const live = await auth.createInvite(sessionToken, undefined);
	await auth.revokeInvite(sessionToken, live.id);
	await expect(
		auth.registerOptions({
			token: live.token,
			handle: "ada",
			displayName: "Ada",
			deviceLabel: "laptop",
		}),
	).rejects.toMatchObject({ code: "invite_revoked" });

	const { invite: used } = await signupMember(auth, sessionToken, "ada");
	await expect(
		auth.registerOptions({
			token: used.token,
			handle: "grace",
			displayName: "Grace",
			deviceLabel: "laptop",
		}),
	).rejects.toMatchObject({ code: "invite_redeemed" });
});

test("eleventh signup cannot claim a seat", async () => {
	const store = new MemoryAuthStore();
	const auth = new AuthService({ env, store, webauthn: mockWebAuthn() });
	const { sessionToken } = await enrollAdmin(auth);
	for (let i = 1; i <= 9; i += 1) {
		await signupMember(auth, sessionToken, `u${i}`);
	}
	expect(store.seats.every((seat) => seat.userId !== null)).toBe(true);
	await expect(signupMember(auth, sessionToken, "u10")).rejects.toMatchObject({
		code: "seats_full",
		status: 409,
	});
	expect(store.users.size).toBe(10);
});

test("member cannot issue invites", async () => {
	const store = new MemoryAuthStore();
	const auth = new AuthService({ env, store, webauthn: mockWebAuthn() });
	const admin = await enrollAdmin(auth);
	const member = await signupMember(auth, admin.sessionToken, "ada");
	await expect(auth.createInvite(member.result.sessionToken, undefined)).rejects.toMatchObject({
		code: "forbidden",
		status: 403,
	});
});

test("admin enroll is invite-less, secret-gated, and single-use", async () => {
	const store = new MemoryAuthStore();
	const auth = new AuthService({ env, store, webauthn: mockWebAuthn() });
	await expect(
		auth.adminEnrollOptions({
			handle: "rishi",
			secret: "wrong-secret-here",
			deviceLabel: "laptop",
		}),
	).rejects.toMatchObject({ code: "forbidden" });
	const first = await enrollAdmin(auth);
	expect(first.handle).toBe("rishi");
	await expect(enrollAdmin(auth)).rejects.toMatchObject({ code: "admin_enrolled" });
});

test("revoked device cannot log in", async () => {
	const store = new MemoryAuthStore();
	const auth = new AuthService({ env, store, webauthn: mockWebAuthn() });
	await enrollAdmin(auth);
	const device = [...store.devices.values()][0];
	if (!device) {
		throw new Error("missing device");
	}
	device.revokedAt = new Date();
	const { challenge } = await auth.loginOptions();
	await expect(
		auth.loginVerify(
			{ ...dummyAssertion, id: device.credentialId.toString("base64url") },
			challenge,
		),
	).rejects.toMatchObject({ code: "device_revoked" });
});

test("mutating routes without Origin are denied", async () => {
	const handlers = createHandlers({
		env,
		store: new MemoryAuthStore(),
		webauthn: mockWebAuthn(),
	});
	const res = await handlers.postInvite(
		new Request("https://meownow.example/api/invites", {
			method: "POST",
			body: JSON.stringify({}),
		}),
	);
	expect(res.status).toBe(403);
	expect(await res.json()).toEqual({ error: "invalid_origin" });
});

test("session cookie flags are set on successful enroll", async () => {
	const handlers = createHandlers({
		env,
		store: new MemoryAuthStore(),
		webauthn: mockWebAuthn(),
	});
	const optionsRes = await handlers.postAdminEnrollOptions(
		new Request("https://meownow.example/api/auth/admin-enroll/options", {
			method: "POST",
			headers: { origin: env.APP_URL, "content-type": "application/json" },
			body: JSON.stringify({
				handle: "rishi",
				secret: env.ADMIN_ENROLL_SECRET,
				deviceLabel: "laptop",
			}),
		}),
	);
	expect(optionsRes.status).toBe(200);
	const challenge = optionsRes.headers.getSetCookie().find((c) => c.startsWith("wn="));
	expect(challenge).toBeDefined();
	const verifyRes = await handlers.postAdminEnrollVerify(
		new Request("https://meownow.example/api/auth/admin-enroll/verify", {
			method: "POST",
			headers: {
				origin: env.APP_URL,
				"content-type": "application/json",
				cookie: challenge ?? "",
			},
			body: JSON.stringify({ credential: dummyAttestation }),
		}),
	);
	expect(verifyRes.status).toBe(200);
	const sid = verifyRes.headers.getSetCookie().find((c) => c.startsWith("sid="));
	expect(sid).toMatch(/HttpOnly/);
	expect(sid).toMatch(/Secure/);
	expect(sid).toMatch(/SameSite=Lax/);
	expect(sid).toMatch(/Path=\//);
});

test("push subscribe without a session cookie is denied", async () => {
	const handlers = createHandlers({
		env: { ...env, VAPID_PUBLIC_KEY: "vapid-public" },
		store: new MemoryAuthStore(),
		webauthn: mockWebAuthn(),
	});
	const res = await handlers.postPushSubscribe(
		new Request("https://meownow.example/api/push/subscribe", {
			method: "POST",
			headers: { origin: env.APP_URL, "content-type": "application/json" },
			body: JSON.stringify({
				endpoint: "https://push.example/sub",
				keys: { p256dh: "p256dh", auth: "auth" },
			}),
		}),
	);
	expect(res.status).toBe(401);
	expect(await res.json()).toEqual({ error: "unauthorized" });
});
