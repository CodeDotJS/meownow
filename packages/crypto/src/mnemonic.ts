import { ENGLISH_WORDLIST } from "./bip39/english";
import { CryptoFailure } from "./errors";

const ENTROPY_BYTES = 16;

function bitsToBytes(bits: string): Uint8Array {
	const bytes = new Uint8Array(bits.length / 8);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = Number.parseInt(bits.slice(i * 8, i * 8 + 8), 2);
	}
	return bytes;
}

function bytesToBits(bytes: Uint8Array): string {
	return Array.from(bytes, (b) => b.toString(2).padStart(8, "0")).join("");
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
	return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes.slice()));
}

export async function generateMnemonic(): Promise<string> {
	const entropy = crypto.getRandomValues(new Uint8Array(ENTROPY_BYTES));
	const hash = await sha256(entropy);
	const hashByte = hash[0];
	if (hashByte === undefined) {
		throw new CryptoFailure("mnemonic", "sha256 failed");
	}
	const checksum = (hashByte >> 4).toString(2).padStart(4, "0");
	const bits = bytesToBits(entropy) + checksum;
	const words: string[] = [];
	for (let i = 0; i < 12; i++) {
		const index = Number.parseInt(bits.slice(i * 11, i * 11 + 11), 2);
		const word = ENGLISH_WORDLIST[index];
		if (!word) {
			throw new CryptoFailure("mnemonic", "wordlist index out of range");
		}
		words.push(word);
	}
	return words.join(" ");
}

export async function validateMnemonic(phrase: string): Promise<boolean> {
	const words = phrase.trim().split(/\s+/);
	if (words.length !== 12) {
		return false;
	}
	const indexes: number[] = [];
	for (const word of words) {
		const index = ENGLISH_WORDLIST.indexOf(word);
		if (index < 0) {
			return false;
		}
		indexes.push(index);
	}
	const bits = indexes.map((index) => index.toString(2).padStart(11, "0")).join("");
	const entropy = bitsToBytes(bits.slice(0, 128));
	const hash = await sha256(entropy);
	const hashByte = hash[0];
	if (hashByte === undefined) {
		return false;
	}
	const expected = (hashByte >> 4).toString(2).padStart(4, "0");
	return bits.slice(128) === expected;
}
