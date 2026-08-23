export type DeviceHint = {
	userAgent: string;
	platform?: string;
	uaPlatform?: string;
	uaModel?: string;
	brands?: { brand: string }[];
};

type NavigatorUAData = {
	brands?: { brand: string; version: string }[];
	platform?: string;
	getHighEntropyValues?: (hints: string[]) => Promise<{
		platform?: string;
		model?: string;
	}>;
};

const IGNORED_BRANDS = new Set(["Chromium", "Not A Brand", "Not=A?Brand", "Not.A/Brand"]);

export function deviceLabelFromHints(hint: DeviceHint): string {
	const browser = browserName(hint);
	const device = deviceName(hint);
	const label = device.toLowerCase() === browser.toLowerCase() ? device : `${browser} on ${device}`;
	return label.slice(0, 64);
}

export async function detectDeviceLabel(nav: Navigator = navigator): Promise<string> {
	const uaData = (nav as Navigator & { userAgentData?: NavigatorUAData }).userAgentData;
	let uaPlatform = uaData?.platform;
	let uaModel: string | undefined;
	if (uaData?.getHighEntropyValues) {
		try {
			const high = await uaData.getHighEntropyValues(["model", "platform"]);
			uaPlatform = high.platform || uaPlatform;
			uaModel = high.model || undefined;
		} catch {
			// Client hints can be denied; the UA string is enough.
		}
	}
	return deviceLabelFromHints({
		userAgent: nav.userAgent,
		platform: nav.platform,
		uaPlatform,
		uaModel,
		brands: uaData?.brands,
	});
}

function browserName(hint: DeviceHint): string {
	const fromBrands = hint.brands?.find((row) => !IGNORED_BRANDS.has(row.brand))?.brand;
	if (fromBrands) {
		return shortenBrand(fromBrands);
	}
	const ua = hint.userAgent;
	if (/Edg(e|iOS|A)?\//.test(ua)) {
		return "Edge";
	}
	if (/OPR\/|Opera/.test(ua)) {
		return "Opera";
	}
	if (/Firefox\/|FxiOS\//.test(ua)) {
		return "Firefox";
	}
	if (/Chrome\/|CriOS\/|Chromium\//.test(ua)) {
		return "Chrome";
	}
	if (/Safari\//.test(ua) && /Version\//.test(ua)) {
		return "Safari";
	}
	return "Browser";
}

function deviceName(hint: DeviceHint): string {
	const model = tidyModel(hint.uaModel);
	if (model) {
		return model;
	}
	const ua = hint.userAgent;
	if (/iPhone/.test(ua)) {
		return "iPhone";
	}
	if (/iPad/.test(ua)) {
		return "iPad";
	}
	if (/iPod/.test(ua)) {
		return "iPod";
	}
	const android = /Android [^;]+; ([^);]+)/.exec(ua)?.[1]?.trim();
	const androidModel = tidyModel(android?.replace(/\s+Build\/.*$/, ""));
	if (androidModel && androidModel !== "Android") {
		return androidModel;
	}
	const platform = hint.uaPlatform || hint.platform || "";
	if (/Win/.test(platform) || /Windows/.test(ua)) {
		return "Windows";
	}
	if (/Mac/.test(platform) || /Macintosh/.test(ua)) {
		return "Mac";
	}
	if (/CrOS/.test(ua)) {
		return "Chromebook";
	}
	if (/Android/.test(ua) || /Linux/.test(platform)) {
		return /Android/.test(ua) ? "Android" : "Linux";
	}
	return "this browser";
}

function tidyModel(value: string | undefined): string | undefined {
	if (!value) {
		return undefined;
	}
	const trimmed = value.replace(/_/g, " ").trim();
	if (!trimmed || trimmed === "K" || /^Linux$/i.test(trimmed)) {
		return undefined;
	}
	return trimmed.slice(0, 40);
}

function shortenBrand(brand: string): string {
	if (/chrome/i.test(brand)) {
		return "Chrome";
	}
	if (/edge/i.test(brand)) {
		return "Edge";
	}
	if (/firefox/i.test(brand)) {
		return "Firefox";
	}
	if (/safari/i.test(brand)) {
		return "Safari";
	}
	if (/opera/i.test(brand)) {
		return "Opera";
	}
	return brand.slice(0, 24);
}
