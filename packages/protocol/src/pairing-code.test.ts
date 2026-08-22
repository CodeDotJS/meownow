import { expect, test } from "vitest";
import {
	formatPairingCode,
	mintPairingCode,
	normalizePairingCode,
	PAIRING_CODE_LENGTH,
} from "./pairing-code";
import { pairingLookupRequestSchema } from "./vault";

test("mintPairingCode is eight unambiguous characters", () => {
	const code = mintPairingCode(new Uint8Array([0, 1, 31, 32, 255, 7, 8, 9]));
	expect(code).toHaveLength(PAIRING_CODE_LENGTH);
	expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{8}$/);
	expect(code.includes("0")).toBe(false);
	expect(code.includes("O")).toBe(false);
	expect(code.includes("1")).toBe(false);
	expect(code.includes("I")).toBe(false);
});

test("normalizePairingCode accepts dashes and lowercase", () => {
	expect(normalizePairingCode("7k3m-2q9p")).toBe("7K3M2Q9P");
	expect(normalizePairingCode("short")).toBeNull();
});

test("formatPairingCode groups for reading aloud", () => {
	expect(formatPairingCode("7K3M2Q9P")).toBe("7K3M-2Q9P");
});

test("pairing lookup accepts a dashed code", () => {
	expect(pairingLookupRequestSchema.parse({ code: "7k3m-2q9p" }).code).toBe("7K3M2Q9P");
	expect(pairingLookupRequestSchema.safeParse({ code: "nope" }).success).toBe(false);
});
