import type { ErrorCode } from "@meownow/protocol";

const PROTOCOL: Record<ErrorCode, string> = {
	invalid_origin: "This origin is not allowed.",
	invalid_body: "That request was malformed.",
	invalid_challenge: "The passkey challenge expired. Try again.",
	invite_invalid: "That invite is not valid.",
	invite_expired: "That invite expired.",
	invite_revoked: "That invite was revoked.",
	invite_redeemed: "That invite was already used.",
	handle_taken: "That username is taken.",
	seats_full: "All ten seats are taken.",
	unauthorized: "Sign in first.",
	forbidden: "Not allowed.",
	unverified: "That passkey did not work. Try again.",
	admin_enrolled: "An admin already exists.",
	suspended: "This account is suspended.",
	device_revoked: "This device was revoked.",
	vault_exists: "This account is already set up. Add this browser as a new device.",
	vault_missing: "This browser has no keys. Show a QR or use the 12 words.",
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
	vault_failed: "Could not finish setup on this device.",
	vault_upload_failed: "Could not finish setup. Try again.",
	pair_failed: "Pairing failed.",
	wrap_failed: "Could not send keys to that device.",
	copy_failed: "Could not copy that.",
	download_failed: "Could not download that file.",
	recover_failed: "Recovery failed.",
	camera_denied: "Camera permission was denied.",
	scan_needs_signin:
		"Sign in on this browser first. Add a device is only for a computer that already works.",
	"fingerprint mismatch": "Numbers did not match. Abort.",
	"No Local peer.": "No peer on this network.",
};

export function statusCopy(status: string): string {
	if (status in PROTOCOL) {
		return PROTOCOL[status as ErrorCode];
	}
	if (status in LOCAL) {
		return LOCAL[status] ?? status;
	}
	const trimmed = status.trim();
	if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
		return LOCAL.copy_failed ?? "Could not copy that.";
	}
	return status;
}
