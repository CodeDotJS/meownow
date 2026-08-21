export function bytesToB64url(bytes: Uint8Array): string {
	let bin = "";
	for (const byte of bytes) {
		bin += String.fromCharCode(byte);
	}
	return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function b64urlToBytes(value: string): Uint8Array {
	const padded = value.replaceAll("-", "+").replaceAll("_", "/");
	const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
	const bin = atob(padded + pad);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i += 1) {
		out[i] = bin.charCodeAt(i);
	}
	return out;
}

export function wrapToWire(wrapped: { iv: Uint8Array; bytes: Uint8Array }) {
	return { iv: bytesToB64url(wrapped.iv), bytes: bytesToB64url(wrapped.bytes) };
}

export function wrapFromWire(wire: { iv: string; bytes: string }) {
	return { iv: b64urlToBytes(wire.iv), bytes: b64urlToBytes(wire.bytes) };
}
