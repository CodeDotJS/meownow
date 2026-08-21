export const INVITE_TTL_MS = 72 * 60 * 60 * 1000;

export type InviteRecord = {
	expiresAt: Date;
	revokedAt: Date | null;
	redeemedAt: Date | null;
};

export type InviteState = "ok" | "missing" | "expired" | "revoked" | "redeemed";

export function inviteState(invite: InviteRecord | null, now: Date): InviteState {
	if (!invite) {
		return "missing";
	}
	if (invite.revokedAt) {
		return "revoked";
	}
	if (invite.redeemedAt) {
		return "redeemed";
	}
	if (invite.expiresAt.getTime() <= now.getTime()) {
		return "expired";
	}
	return "ok";
}

export function inviteExpiresAt(now: Date): Date {
	return new Date(now.getTime() + INVITE_TTL_MS);
}
