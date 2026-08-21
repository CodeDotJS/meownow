export const STUN_URLS = ["stun:stun.cloudflare.com:3478"];

export function isHostCandidate(candidate: string): boolean {
	return /(?:^|\s)typ host(?:\s|$)/.test(candidate);
}

export function isLanPair(localType: string, remoteType: string): boolean {
	return localType === "host" && remoteType === "host";
}
