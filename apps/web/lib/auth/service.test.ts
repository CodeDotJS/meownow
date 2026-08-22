import type { WebEnv } from "@meownow/config/env";
import { AUTH_LIMIT_USER_ID, mintHubTicket } from "@meownow/protocol";
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

test("upload intent without a session is denied", async () => {
	const handlers = createHandlers({
		env: { ...env, EDGE_URL: "https://edge.example", CAPABILITY_TOKEN_PRIVATE_KEY: "x" },
		store: new MemoryAuthStore(),
		webauthn: mockWebAuthn(),
	});
	const res = await handlers.postUploadIntent(
		new Request("https://meownow.example/api/uploads/intent", {
			method: "POST",
			headers: { origin: env.APP_URL, "content-type": "application/json" },
			body: JSON.stringify({ kind: "file", byteSize: 8, chunkCount: 1 }),
		}),
	);
	expect(res.status).toBe(401);
	expect(await res.json()).toEqual({ error: "unauthorized" });
});

test("member cannot list users, audit, or remove anyone", async () => {
	const store = new MemoryAuthStore();
	const auth = new AuthService({ env, store, webauthn: mockWebAuthn() });
	const admin = await enrollAdmin(auth);
	const member = await signupMember(auth, admin.sessionToken, "ada");
	const token = member.result.sessionToken;
	await expect(auth.listUsers(token)).rejects.toMatchObject({ code: "forbidden", status: 403 });
	await expect(auth.listAudit(token)).rejects.toMatchObject({ code: "forbidden", status: 403 });
	const ada = [...store.users.values()].find((row) => row.handle === "ada");
	await expect(auth.removeUser(token, ada?.id ?? "")).rejects.toMatchObject({
		code: "forbidden",
		status: 403,
	});
});

test("removing a member frees the seat; the last admin cannot be removed", async () => {
	const store = new MemoryAuthStore();
	const auth = new AuthService({ env, store, webauthn: mockWebAuthn() });
	const admin = await enrollAdmin(auth);
	await signupMember(auth, admin.sessionToken, "ada");
	expect(store.seats.filter((seat) => seat.userId !== null)).toHaveLength(2);
	const ada = [...store.users.values()].find((row) => row.handle === "ada");
	expect(ada).toBeDefined();
	await auth.removeUser(admin.sessionToken, ada?.id ?? "");
	expect(store.users.has(ada?.id ?? "")).toBe(false);
	expect(store.seats.filter((seat) => seat.userId !== null)).toHaveLength(1);
	const adminUser = [...store.users.values()].find((row) => row.role === "admin");
	await expect(auth.removeUser(admin.sessionToken, adminUser?.id ?? "")).rejects.toMatchObject({
		code: "last_admin",
		status: 409,
	});
});

test("revoking a device kills its session", async () => {
	const store = new MemoryAuthStore();
	const auth = new AuthService({ env, store, webauthn: mockWebAuthn() });
	const admin = await enrollAdmin(auth);
	const member = await signupMember(auth, admin.sessionToken, "ada");
	const ada = [...store.users.values()].find((row) => row.handle === "ada");
	const device = [...store.devices.values()].find((row) => row.userId === ada?.id);
	expect(device).toBeDefined();
	await auth.revokeDevice(admin.sessionToken, device?.id ?? "");
	await expect(auth.me(member.result.sessionToken)).rejects.toMatchObject({
		code: "unauthorized",
	});
	expect(store.devices.get(device?.id ?? "")?.revokedAt).toBeInstanceOf(Date);
	expect(store.audit.some((row) => row.action === "device.revoked")).toBe(true);
});

test("auth options are rate-limited per IP", async () => {
	const handlers = createHandlers({
		env,
		store: new MemoryAuthStore(),
		webauthn: mockWebAuthn(),
		limits: { take: async () => false },
	});
	const res = await handlers.postLoginOptions(
		new Request("https://meownow.example/api/auth/login/options", {
			method: "POST",
			headers: { origin: env.APP_URL, "content-type": "application/json" },
			body: "{}",
		}),
	);
	expect(res.status).toBe(429);
	expect(await res.json()).toEqual({ error: "rate_limited" });
});

test("internal prune without a cron ticket is denied", async () => {
	const handlers = createHandlers({
		env: { ...env, HUB_SECRET: "0".repeat(32) },
		store: new MemoryAuthStore(),
		webauthn: mockWebAuthn(),
	});
	const res = await handlers.postInternalPrune(
		new Request("https://meownow.example/api/internal/prune", { method: "POST" }),
	);
	expect(res.status).toBe(401);
	expect(await res.json()).toEqual({ error: "unauthorized" });
});

test("internal prune with a cron ticket returns keep and delete keys", async () => {
	const secret = "0".repeat(32);
	const ticket = await mintHubTicket(secret, {
		v: 1,
		purpose: "cron",
		userId: AUTH_LIMIT_USER_ID,
		exp: Date.now() + 30_000,
	});
	const handlers = createHandlers({
		env: { ...env, HUB_SECRET: secret },
		store: new MemoryAuthStore(),
		webauthn: mockWebAuthn(),
	});
	const res = await handlers.postInternalPrune(
		new Request("https://meownow.example/api/internal/prune", {
			method: "POST",
			headers: { authorization: `Bearer ${ticket}` },
		}),
	);
	expect(res.status).toBe(200);
	expect(await res.json()).toEqual({ keepR2Keys: [], deleteR2Keys: [] });
});
