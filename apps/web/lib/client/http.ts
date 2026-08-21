export async function postJson(
	url: string,
	body: unknown,
): Promise<{
	ok: boolean;
	status: number;
	data: unknown;
}> {
	const res = await fetch(url, {
		method: "POST",
		credentials: "include",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
	let data: unknown = null;
	try {
		data = await res.json();
	} catch {
		data = null;
	}
	return { ok: res.ok, status: res.status, data };
}

export async function getJson(url: string): Promise<{
	ok: boolean;
	status: number;
	data: unknown;
}> {
	const res = await fetch(url, { credentials: "include" });
	let data: unknown = null;
	try {
		data = await res.json();
	} catch {
		data = null;
	}
	return { ok: res.ok, status: res.status, data };
}

export function errorCode(data: unknown): string {
	if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
		return data.error;
	}
	return "request_failed";
}
