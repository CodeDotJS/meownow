import type { ErrorCode } from "@meownow/protocol";

const PROTOCOL: Record<ErrorCode, string> = {
	invalid_origin: "This origin is not allowed.",
	invalid_body: "That request was malformed.",
	invalid_challenge: "The passkey challenge expired. Try again.",
	invite_invalid: "That invite is not valid.",
	invite_expired: "That invite expired.",
	invite_revoked: "That invite was revoked.",
	invite_redeemed: "That invite was already used.",
	handle_taken: "That handle is taken.",
	seats_full: "All ten seats are taken.",
	unauthorized: "Sign in first.",
	forbidden: "Not allowed.",
	unverified: "Passkey verification failed.",
	admin_enrolled: "An admin already exists.",
	suspended: "This account is suspended.",
	device_revoked: "This device was revoked.",
	vault_exists: "A vault already exists. Pair this device instead.",
	vault_missing: "No vault on this device.",
	pairing_expired: "That pairing expired. Start again.",
	pairing_missing: "That pairing was not found.",
	pairing_complete: "That pairing already finished.",
	recovery_invalid: "Those words did not match.",
	item_invalid: "That item is too large or empty.",
	item_expired: "That item expired.",
	hub_unconfigured: "Live sync is not configured.",
	push_unconfigured: "Push is not configured.",
	capability_unconfigured: "Uploads are not configured.",
	quota_exceeded: "Storage quota is full.",
	request_pending: "A request is already pending.",
	not_found: "Not found.",
	last_admin: "Cannot remove the last admin.",
	rate_limited: "Too many attempts. Wait and retry.",
};

const LOCAL: Record<string, string> = {
	request_failed: "Request failed.",
	passkey_failed: "Passkey was cancelled or failed.",
	vault_failed: "Could not create the vault.",
	pair_failed: "Pairing failed.",
	wrap_failed: "Could not wrap the vault for that device.",
	recover_failed: "Recovery failed.",
	camera_denied: "Camera permission was denied.",
	"fingerprint mismatch": "Numbers did not match. Abort.",
	"No Local peer.": "No peer on this network.",
};

export function statusCopy(status: string): string {
	if (status in PROTOCOL) {
		return PROTOCOL[status as ErrorCode];
	}
	return LOCAL[status] ?? status;
}
