export type InviteRow = {
	id: string;
	note: string | null;
	expiresAt: string;
	redeemedAt: string | null;
	revokedAt: string | null;
	createdAt: string;
};

export function isOpenInvite(invite: InviteRow, now = new Date()): boolean {
	if (invite.revokedAt || invite.redeemedAt) {
		return false;
	}
	return Date.parse(invite.expiresAt) > now.getTime();
}

export function openInvites(invites: InviteRow[], now = new Date()): InviteRow[] {
	return invites.filter((invite) => isOpenInvite(invite, now));
}

export function formatInviteLeft(expiresAt: string, now = Date.now()): string {
	const ms = Date.parse(expiresAt) - now;
	if (Number.isNaN(ms) || ms <= 0) {
		return "expired";
	}
	const hours = Math.ceil(ms / 3_600_000);
	if (hours < 24) {
		return hours === 1 ? "1 hour left" : `${hours} hours left`;
	}
	const days = Math.ceil(hours / 24);
	return days === 1 ? "1 day left" : `${days} days left`;
}
