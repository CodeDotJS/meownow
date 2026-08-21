import { type PairingQr, pairingQrSchema } from "@meownow/protocol";

export function parsePairingQr(raw: string): PairingQr | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}
	const result = pairingQrSchema.safeParse(parsed);
	return result.success ? result.data : null;
}
