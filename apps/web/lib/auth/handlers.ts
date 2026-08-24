import type { WebEnv } from "@meownow/config/env";
import { neonTransportNotice, sha256 } from "@meownow/db";
import {
	accountDeleteRequestSchema,
	adminEnrollOptionsRequestSchema,
	deviceLabelSchema,
	type ErrorCode,
	errorEnvelopeSchema,
	handleSchema,
	inviteAskRequestSchema,
	inviteCreateRequestSchema,
	itemCreateRequestSchema,
	loginVerifyRequestSchema,
	openHubTicket,
	pairingLookupRequestSchema,
	pairingStartRequestSchema,
	pairingWrapRequestSchema,
	pushSubscribeRequestSchema,
	registerOptionsRequestSchema,
	registerVerifyRequestSchema,
	uploadCommitRequestSchema,
	uploadIntentRequestSchema,
	uploadRequestCreateSchema,
	uploadRequestDecideSchema,
	uploadTicketRequestSchema,
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
import type { BlobPort } from "../vault/blobs";
import type { HubPort } from "../vault/hub";
import { type LimitPort, silentLimits } from "../vault/limits";
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
	blobs?: BlobPort;
	limits?: LimitPort;
	webauthn?: WebAuthnPort;
	now?: () => Date;
};

export function createHandlers(deps: HandlerDeps) {
	const auth = new AuthService(deps);
	const limits = deps.limits ?? silentLimits();
	const vault = new VaultService({
		env: deps.env,
		auth: deps.store,
		vault: deps.store,
		hub: deps.hub,
		push: deps.push ?? silentPush(),
		blobs: deps.blobs,
		limits,
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
		postInviteAsk: (request: Request) =>
			mutating(request, deps.env, async () => {
				await requireAuthLimit(limits, request);
				const body = await readBody(request, inviteAskRequestSchema);
				return json(await auth.createAsk({ email: body.email, note: body.note }));
			}),
		getInviteAsks: (request: Request) => run(async () => json(await auth.listAsks(sid(request)))),
		deleteInviteAsk: (request: Request, id: string) =>
			mutating(request, deps.env, async () => {
				await auth.dismissAsk(sid(request), id);
				return json({ ok: true });
			}),
		postRegisterOptions: (request: Request) =>
			mutating(request, deps.env, async () => {
				await requireAuthLimit(limits, request);
				const body = await readBody(request, registerOptionsRequestSchema);
				const result = await auth.registerOptions(body);
				return json({ options: result.options }, [challengeSet(result.challenge)]);
			}),
		postRegisterVerify: (request: Request) =>
			mutating(request, deps.env, async () => {
				await requireAuthLimit(limits, request);
				const body = await readBody(request, registerVerifyRequestSchema);
				const result = await auth.registerVerify(
					toRegistrationResponse(body.credential),
					wn(request),
				);
				return signedIn(result.handle, result.sessionToken);
			}),
		postAdminEnrollOptions: (request: Request) =>
			mutating(request, deps.env, async () => {
				await requireAuthLimit(limits, request);
				const body = await readBody(request, adminEnrollOptionsRequestSchema);
				const result = await auth.adminEnrollOptions(body);
				return json({ options: result.options }, [challengeSet(result.challenge)]);
			}),
		postAdminEnrollVerify: (request: Request) =>
			mutating(request, deps.env, async () => {
				await requireAuthLimit(limits, request);
				const body = await readBody(request, registerVerifyRequestSchema);
				const result = await auth.adminEnrollVerify(
					toRegistrationResponse(body.credential),
					wn(request),
				);
				return signedIn(result.handle, result.sessionToken);
			}),
		postLoginOptions: (request: Request) =>
			mutating(request, deps.env, async () => {
				await requireAuthLimit(limits, request);
				const result = await auth.loginOptions();
				return json({ options: result.options, challenge: result.challenge }, [
					challengeSet(result.challenge),
				]);
			}),
		postLoginVerify: (request: Request) =>
			mutating(request, deps.env, async () => {
				await requireAuthLimit(limits, request);
				const body = await readBody(request, loginVerifyRequestSchema);
				const result = await auth.loginVerify(
					toAuthenticationResponse(body.credential),
					body.challenge ?? wn(request),
				);
				return signedIn(result.handle, result.sessionToken);
			}),
		postLogout: (request: Request) =>
			mutating(request, deps.env, async () => {
				await auth.logout(sid(request));
				return json({ ok: true }, [expireCookie(SESSION_COOKIE), expireCookie(CHALLENGE_COOKIE)]);
			}),
		postDeleteAccount: (request: Request) =>
			mutating(request, deps.env, async () => {
				const body = await readBody(request, accountDeleteRequestSchema);
				await auth.deleteAccount(sid(request), body.handle);
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
		postPairingLookup: (request: Request) =>
			mutating(request, deps.env, async () => {
				await requireAuthLimit(limits, request);
				const body = await readBody(request, pairingLookupRequestSchema);
				return json(await vault.lookupPairing(sid(request), body.code));
			}),
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
		postUploadRequest: (request: Request) =>
			mutating(request, deps.env, async () => {
				const body = await readBody(request, uploadRequestCreateSchema);
				return json(await vault.requestUpload(sid(request), body.reason));
			}),
		getUploadRequests: (request: Request) =>
			run(async () => json(await vault.listUploadRequests(sid(request)))),
		postUploadDecide: (request: Request, id: string) =>
			mutating(request, deps.env, async () => {
				const body = await readBody(request, uploadRequestDecideSchema);
				return json(await vault.decideUpload(sid(request), id, body));
			}),
		postUploadIntent: (request: Request) =>
			mutating(request, deps.env, async () => {
				const body = await readBody(request, uploadIntentRequestSchema);
				return json(await vault.uploadIntent(sid(request), body));
			}),
		postUploadTicket: (request: Request) =>
			mutating(request, deps.env, async () => {
				const body = await readBody(request, uploadTicketRequestSchema);
				return json(await vault.uploadTicket(sid(request), body));
			}),
		postUploadCommit: (request: Request) =>
			mutating(request, deps.env, async () => {
				const body = await readBody(request, uploadCommitRequestSchema);
				return json(await vault.commitUpload(sid(request), body));
			}),
		getAdminUsers: (request: Request) => run(async () => json(await auth.listUsers(sid(request)))),
		getAdminAudit: (request: Request) => run(async () => json(await auth.listAudit(sid(request)))),
		getAdminUsage: (request: Request) =>
			run(async () => json(await vault.adminUsage(sid(request)))),
		postAdminRevokeDevice: (request: Request, id: string) =>
			mutating(request, deps.env, async () => {
				const revoked = await auth.revokeDevice(sid(request), id);
				await vault.publishDeviceRevoked(revoked.userId, revoked.deviceId);
				return json({ ok: true });
			}),
		postAdminRemoveUser: (request: Request, id: string) =>
			mutating(request, deps.env, async () => {
				await auth.removeUser(sid(request), id);
				return json({ ok: true });
			}),
		postInternalPrune: (request: Request) =>
			run(async () => {
				if (!deps.env.HUB_SECRET) {
					throw new AuthError("hub_unconfigured", 503);
				}
				const header = request.headers.get("authorization") ?? "";
				const token = header.startsWith("Bearer ") ? header.slice(7) : "";
				const ticket = await openHubTicket(deps.env.HUB_SECRET, token);
				if (ticket?.purpose !== "cron") {
					throw new AuthError("unauthorized", 401);
				}
				return json(await vault.prune());
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
	const headers = new Headers({
		"content-type": "application/json",
		"cache-control": "no-store",
	});
	const notice = neonTransportNotice();
	if (notice) {
		headers.set("x-meownow-notice", notice);
	}
	for (const cookie of cookies) {
		headers.append("Set-Cookie", cookie);
	}
	return new Response(JSON.stringify(data), { status, headers });
}

function errorResponse(error: ErrorCode, status: number): Response {
	const body = errorEnvelopeSchema.parse({ error });
	return json(body, [], status);
}

async function requireAuthLimit(limits: LimitPort, request: Request): Promise<void> {
	const forwarded = request.headers.get("x-forwarded-for");
	const ip =
		forwarded?.split(",")[0]?.trim() || request.headers.get("cf-connecting-ip") || "0.0.0.0";
	const allowed = await limits.take("auth", sha256(Buffer.from(ip)).toString("hex"));
	if (!allowed) {
		throw new AuthError("rate_limited", 429);
	}
}
