import type { WebEnv } from "@meownow/config/env";
import {
	adminEnrollOptionsRequestSchema,
	type ErrorCode,
	errorEnvelopeSchema,
	inviteCreateRequestSchema,
	loginVerifyRequestSchema,
	registerOptionsRequestSchema,
	registerVerifyRequestSchema,
} from "@meownow/protocol";
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
import { AuthService } from "./service";
import { AuthError, type AuthStore } from "./store";
import { toAuthenticationResponse, toRegistrationResponse, type WebAuthnPort } from "./webauthn";

export type HandlerDeps = {
	env: WebEnv;
	store: AuthStore;
	webauthn?: WebAuthnPort;
	now?: () => Date;
};

export function createHandlers(deps: HandlerDeps) {
	const auth = new AuthService(deps);

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
