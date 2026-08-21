import { concatBytes, u32be } from "./bytes";
import { SCHEMA_VERSION } from "./constants";

export type ItemKind = "text" | "link" | "image" | "file";

export type AadInput = {
	itemId: string;
	kind: ItemKind;
	schemaVersion?: number;
};

export function encodeAad(input: AadInput): Uint8Array {
	const encoder = new TextEncoder();
	const id = encoder.encode(input.itemId);
	const kind = encoder.encode(input.kind);
	const version = u32be(input.schemaVersion ?? SCHEMA_VERSION);
	return concatBytes(id, new Uint8Array([0]), kind, new Uint8Array([0]), version);
}
