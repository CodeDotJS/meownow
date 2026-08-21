import type { WebEnv } from "@meownow/config/env";
import {
	adminEnrollOptionsRequestSchema,
	deviceLabelSchema,
	type ErrorCode,
	errorEnvelopeSchema,
	handleSchema,
	inviteCreateRequestSchema,
	itemCreateRequestSchema,
	loginVerifyRequestSchema,
	pairingStartRequestSchema,
	pairingWrapRequestSchema,
	pushSubscribeRequestSchema,
	registerOptionsRequestSchema,
	registerVerifyRequestSchema,
	vaultPutRequestSchema,
	vaultRecoveryRequestSchema,
} from "@meownow/protocol";
import { z } from "zod";
import {
	CHALLENGE_COOKIE,
	challengeCookieOptions,
	expireCookie,
	readCookie,
	SESSION_COOKIE,
	serializeCookie,
	sessionCookieOptions,
} from "../cookies";
import { originAllowed } from "../origin";
import type { HubPort } from "../vault/hub";
import { type PushPort, silentPush } from "../vault/push";
import { VaultService } from "../vault/service";
import type { VaultStore } from "../vault/store";
import { AuthService } from "./service";
import { AuthError, type AuthStore } from "./store";
import { toAuthenticationResponse, toRegistrationResponse, type WebAuthnPort } from "./webauthn";

export type HandlerDeps = {
	env: WebEnv;
	store: AuthStore & VaultStore;
	hub?: HubPort;
	push?: PushPort;
	webauthn?: WebAuthnPort;
	now?: () => Date;
};

export function createHandlers(deps: HandlerDeps) {
	const auth = new AuthService(deps);
	const vault = new VaultService({
		env: deps.env,
		auth: deps.store,
		vault: deps.store,
		hub: deps.hub,
		push: deps.push ?? silentPush(),
		webauthn: deps.webauthn,
		now: deps.now,
	});

	return {
		postInvite: (request: Request) =>
			mutating(request, deps.env, async () => {
				const body = await readBody(request, inviteCreateRequestSchema);
				const created = await auth.createInvite(sid(request), body.note);
				return json(created);
			}),
		getInvites: (request: Request) =>
			run(async () => {
				const list = await auth.listInvites(sid(request));
				return json(list);
			}),
		deleteInvite: (request: Request, id: string) =>
			mutating(request, deps.env, async () => {
				await auth.revokeInvite(sid(request), id);
				return json({ ok: true });
			}),
		postRegisterOptions: (request: Request) =>
			mutating(request, deps.env, async () => {
				const body = await readBody(request, registerOptionsRequestSchema);
				const result = await auth.registerOptions(body);
				return json({ options: result.options }, [challengeSet(result.challenge)]);
			}),
		postRegisterVerify: (request: Request) =>
			mutating(request, deps.env, async () => {
				const body = await readBody(request, registerVerifyRequestSchema);
				const result = await auth.registerVerify(
					toRegistrationResponse(body.credential),
					wn(request),
				);
				return signedIn(result.handle, result.sessionToken);
			}),
		postAdminEnrollOptions: (request: Request) =>
			mutating(request, deps.env, async () => {
				const body = await readBody(request, adminEnrollOptionsRequestSchema);
				const result = await auth.adminEnrollOptions(body);
				return json({ options: result.options }, [challengeSet(result.challenge)]);
			}),
		postAdminEnrollVerify: (request: Request) =>
			mutating(request, deps.env, async () => {
				const body = await readBody(request, registerVerifyRequestSchema);
				const result = await auth.adminEnrollVerify(
					toRegistrationResponse(body.credential),
					wn(request),
				);
				return signedIn(result.handle, result.sessionToken);
			}),
		postLoginOptions: (request: Request) =>
			mutating(request, deps.env, async () => {
				const result = await auth.loginOptions();
				return json({ options: result.options }, [challengeSet(result.challenge)]);
			}),
		postLoginVerify: (request: Request) =>
			mutating(request, deps.env, async () => {
				const body = await readBody(request, loginVerifyRequestSchema);
				const result = await auth.loginVerify(
					toAuthenticationResponse(body.credential),
					wn(request),
				);
				return signedIn(result.handle, result.sessionToken);
			}),
		postLogout: (request: Request) =>
			mutating(request, deps.env, async () => {
				await auth.logout(sid(request));
				return json({ ok: true }, [expireCookie(SESSION_COOKIE), expireCookie(CHALLENGE_COOKIE)]);
			}),
		getMe: (request: Request) =>
			run(async () => {
				const result = await auth.me(sid(request));
				return json(result.profile, [
					serializeCookie(SESSION_COOKIE, result.sessionToken, sessionCookieOptions()),
				]);
			}),
		putVault: (request: Request) =>
			mutating(request, deps.env, async () => {
				const body = await readBody(request, vaultPutRequestSchema);
				await vault.putVault(sid(request), body);
				return json({ ok: true });
			}),
		postVaultRecovery: (request: Request) =>
			mutating(request, deps.env, async () => {
				const body = await readBody(request, vaultRecoveryRequestSchema);
				return json(await vault.getRecovery(body.handle));
			}),
		postPairing: (request: Request) =>
			mutating(request, deps.env, async () => {
				const body = await readBody(request, pairingStartRequestSchema);
				return json(await vault.startPairing(body.publicJwk));
			}),
		getPairing: (_request: Request, id: string) =>
			run(async () => json(await vault.getPairing(id))),
		postPairingWrap: (request: Request, id: string) =>
			mutating(request, deps.env, async () => {
				const body = await readBody(request, pairingWrapRequestSchema);
				await vault.postWrap(sid(request), id, body);
				return json({ ok: true });
			}),
		postPairingRegisterOptions: (request: Request, id: string) =>
			mutating(request, deps.env, async () => {
				const body = await readBody(request, z.object({ deviceLabel: deviceLabelSchema }));
				const result = await vault.pairingRegisterOptions(id, body.deviceLabel);
				return json({ options: result.options }, [challengeSet(result.challenge)]);
			}),
		postPairingRegisterVerify: (request: Request) =>
			mutating(request, deps.env, async () => {
				const body = await readBody(request, registerVerifyRequestSchema);
				const result = await vault.pairingRegisterVerify(
					toRegistrationResponse(body.credential),
					wn(request),
				);
				return signedIn(result.handle, result.sessionToken);
			}),
		postRecoveryRegisterOptions: (request: Request) =>
			mutating(request, deps.env, async () => {
				const body = await readBody(
					request,
					z.object({
						handle: handleSchema,
						verifier: z.string().min(1),
						deviceLabel: deviceLabelSchema,
					}),
				);
				const result = await vault.recoveryRegisterOptions(body);
				return json({ options: result.options }, [challengeSet(result.challenge)]);
			}),
		postRecoveryRegisterVerify: (request: Request) =>
			mutating(request, deps.env, async () => {
				const body = await readBody(request, registerVerifyRequestSchema);
				const result = await vault.recoveryRegisterVerify(
					toRegistrationResponse(body.credential),
					wn(request),
				);
				return signedIn(result.handle, result.sessionToken);
			}),
		postItem: (request: Request) =>
			mutating(request, deps.env, async () => {
				const body = await readBody(request, itemCreateRequestSchema);
				await vault.createItem(sid(request), body);
				return json({ ok: true });
			}),
		getItems: (request: Request) => run(async () => json(await vault.listItems(sid(request)))),
		deleteItem: (request: Request, id: string) =>
			mutating(request, deps.env, async () => {
				await vault.deleteItem(sid(request), id);
				return json({ ok: true });
			}),
		getHubTicket: (request: Request) => run(async () => json(await vault.hubTicket(sid(request)))),
		getVapid: (request: Request) => run(async () => json(await vault.vapidPublic(sid(request)))),
		postPushSubscribe: (request: Request) =>
			mutating(request, deps.env, async () => {
				const body = await readBody(request, pushSubscribeRequestSchema);
				return json(await vault.subscribePush(sid(request), body));
			}),
	};
}

async function mutating(
	request: Request,
	env: WebEnv,
	fn: () => Promise<Response>,
): Promise<Response> {
	if (!originAllowed(request, env.APP_URL)) {
		return errorResponse("invalid_origin", 403);
	}
	return run(fn);
}

async function run(fn: () => Promise<Response>): Promise<Response> {
	try {
		return await fn();
	} catch (err) {
		if (err instanceof AuthError) {
			return errorResponse(err.code, err.status);
		}
		throw err;
	}
}

async function readBody<T>(
	request: Request,
	schema: { safeParse: (data: unknown) => { success: true; data: T } | { success: false } },
): Promise<T> {
	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		throw new AuthError("invalid_body", 400);
	}
	const parsed = schema.safeParse(raw);
	if (!parsed.success) {
		throw new AuthError("invalid_body", 400);
	}
	return parsed.data;
}

function sid(request: Request): string | undefined {
	return readCookie(request.headers.get("cookie"), SESSION_COOKIE);
}

function wn(request: Request): string | undefined {
	return readCookie(request.headers.get("cookie"), CHALLENGE_COOKIE);
}

function challengeSet(value: string): string {
	return serializeCookie(CHALLENGE_COOKIE, value, challengeCookieOptions());
}

function signedIn(handle: string, sessionToken: string): Response {
	return json({ ok: true, handle }, [
		serializeCookie(SESSION_COOKIE, sessionToken, sessionCookieOptions()),
		expireCookie(CHALLENGE_COOKIE),
	]);
}

function json(data: unknown, cookies: string[] = [], status = 200): Response {
	const headers = new Headers({ "content-type": "application/json" });
	for (const cookie of cookies) {
		headers.append("Set-Cookie", cookie);
	}
	return new Response(JSON.stringify(data), { status, headers });
}

function errorResponse(error: ErrorCode, status: number): Response {
	const body = errorEnvelopeSchema.parse({ error });
	return json(body, [], status);
}
