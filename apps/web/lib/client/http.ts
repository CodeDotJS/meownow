import { readTransportNotice } from "./transport-notice";

const OFFLINE = { ok: false, status: 0, data: { error: "request_failed" } } as const;

export async function postJson(
	url: string,
	body: unknown,
): Promise<{
	ok: boolean;
	status: number;
	data: unknown;
}> {
	try {
		const res = await fetch(url, {
			method: "POST",
			credentials: "include",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
		});
		readTransportNotice(res);
		return { ok: res.ok, status: res.status, data: await readJson(res) };
	} catch {
		return { ...OFFLINE };
	}
}

export async function getJson(url: string): Promise<{
	ok: boolean;
	status: number;
	data: unknown;
}> {
	try {
		const res = await fetch(url, { credentials: "include", cache: "no-store" });
		readTransportNotice(res);
		return { ok: res.ok, status: res.status, data: await readJson(res) };
	} catch {
		return { ...OFFLINE };
	}
}

export async function deleteJson(url: string): Promise<{
	ok: boolean;
	status: number;
	data: unknown;
}> {
	try {
		const res = await fetch(url, { method: "DELETE", credentials: "include" });
		readTransportNotice(res);
		return { ok: res.ok, status: res.status, data: await readJson(res) };
	} catch {
		return { ...OFFLINE };
	}
}

export function errorCode(data: unknown): string {
	if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
		return data.error;
	}
	return "request_failed";
}

async function readJson(res: Response): Promise<unknown> {
	try {
		return await res.json();
	} catch {
		return null;
	}
}
