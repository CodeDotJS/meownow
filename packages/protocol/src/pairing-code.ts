export const PAIRING_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
export const PAIRING_CODE_LENGTH = 8;

export function mintPairingCode(
	bytes = crypto.getRandomValues(new Uint8Array(PAIRING_CODE_LENGTH)),
): string {
	let out = "";
	for (let i = 0; i < PAIRING_CODE_LENGTH; i += 1) {
		const index = (bytes[i] ?? 0) % PAIRING_CODE_ALPHABET.length;
		const next = PAIRING_CODE_ALPHABET[index];
		if (next) {
			out += next;
		}
	}
	return out;
}

export function normalizePairingCode(raw: string): string | null {
	const cleaned = raw.toUpperCase().replace(/[^23456789ABCDEFGHJKMNPQRSTVWXYZ]/g, "");
	return cleaned.length === PAIRING_CODE_LENGTH ? cleaned : null;
}

export function formatPairingCode(code: string): string {
	const normalized = normalizePairingCode(code) ?? code;
	return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
}
