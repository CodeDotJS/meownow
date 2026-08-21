export class CryptoFailure extends Error {
	readonly code: "tamper" | "truncate" | "mnemonic";

	constructor(code: CryptoFailure["code"], message: string) {
		super(message);
		this.name = "CryptoFailure";
		this.code = code;
	}
}
