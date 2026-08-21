import { expect, test } from "vitest";
import { parsePairingQr } from "./qr";

const sample = {
	v: 1 as const,
	id: "daaee2dd-3c7e-48f0-9c7c-797bcbac36a9",
	publicJwk: {
		kty: "EC",
		crv: "P-256",
		x: "Jwa2a1RcPIXa8PXlh_IOyyrwA-OHFoa5XYFDUzohBnE",
		y: "seDxBHlXcWAA-dkTAFGnzNOvKMLcCrKHDKJyhhlGGmU",
	},
};

test("parsePairingQr accepts a pairing QR payload", () => {
	expect(parsePairingQr(JSON.stringify(sample))).toEqual(sample);
});

test("parsePairingQr rejects junk", () => {
	expect(parsePairingQr("not json")).toBeNull();
	expect(parsePairingQr("{}")).toBeNull();
});
