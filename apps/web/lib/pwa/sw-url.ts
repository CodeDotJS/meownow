export const SW_PATH = "/sw.js";
export const SW_TRUSTED_TYPES_POLICY = "meownow#sw";

type SwTrustedScriptURL = { toString(): string };

type SwTrustedTypePolicy = {
	createScriptURL(input: string): SwTrustedScriptURL;
};

type SwTrustedTypes = {
	createPolicy(
		name: string,
		rules: { createScriptURL: (url: string) => string },
	): SwTrustedTypePolicy;
};

let policy: SwTrustedTypePolicy | undefined;

export function swScriptUrl(): string | SwTrustedScriptURL {
	const trusted = (globalThis as { trustedTypes?: SwTrustedTypes }).trustedTypes;
	if (!trusted) {
		return SW_PATH;
	}
	policy ??= trusted.createPolicy(SW_TRUSTED_TYPES_POLICY, {
		createScriptURL: (url: string) => {
			if (url === SW_PATH) {
				return url;
			}
			throw new TypeError("blocked");
		},
	});
	return policy.createScriptURL(SW_PATH);
}
