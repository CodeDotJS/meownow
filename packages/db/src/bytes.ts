import { createHash, randomBytes } from "node:crypto";

export function sha256(data: Buffer | string): Buffer {
	return createHash("sha256").update(data).digest();
}

export function randomToken(bytes = 32): Buffer {
	return randomBytes(bytes);
}

export function toBase64Url(data: Buffer): string {
	return data.toString("base64url");
}

export function fromBase64Url(value: string): Buffer {
	return Buffer.from(value, "base64url");
}

export function uuidToBytes(id: string): Uint8Array {
	const hex = id.replaceAll("-", "");
	if (hex.length !== 32) {
		throw new Error("invalid uuid");
	}
	const out = new Uint8Array(16);
	for (let i = 0; i < 16; i += 1) {
		out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return out;
}
