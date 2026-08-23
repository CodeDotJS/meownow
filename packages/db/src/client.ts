import { setDefaultResultOrder } from "node:dns";
import { neon, neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Agent, type RequestInit, fetch as undiciFetch } from "undici";
import ws from "ws";
import { isConnectFailure } from "./connect-failure";
import * as schema from "./schema";

const httpDbs = new Map<string, HttpDatabase>();
const ipv4Agent = new Agent({ connect: { family: 4 } });
const RETRY_IPV6_MS = 5 * 60 * 1000;

let usingIpv4 = false;
let ipv4Since = 0;
let transportNotice: "ipv6_unreachable" | null = null;

export function websocketConstructor(): typeof WebSocket {
	if (typeof globalThis.WebSocket === "function") {
		return globalThis.WebSocket;
	}
	return ws as unknown as typeof WebSocket;
}

function openHttpDb(connectionString: string) {
	neonConfig.webSocketConstructor = websocketConstructor();
	return drizzleHttp({ client: neon(connectionString), schema });
}

export function createHttpDb(connectionString: string) {
	const cached = httpDbs.get(connectionString);
	if (cached) {
		return cached;
	}
	const db = openHttpDb(connectionString);
	httpDbs.set(connectionString, db);
	return db;
}

export function createPool(connectionString: string): Pool {
	neonConfig.webSocketConstructor = websocketConstructor();
	return new Pool({ connectionString });
}

export function createDb(pool: Pool) {
	return drizzle({ client: pool, schema });
}

export function neonTransportNotice(): "ipv6_unreachable" | null {
	return transportNotice;
}

export function resetNeonTransportForTests(): void {
	usingIpv4 = false;
	ipv4Since = 0;
	transportNotice = null;
	neonConfig.fetchFunction = fetch;
}

function preferIpv4(): boolean {
	return usingIpv4 && Date.now() - ipv4Since < RETRY_IPV6_MS;
}

function switchToIpv4(): void {
	usingIpv4 = true;
	ipv4Since = Date.now();
	transportNotice = "ipv6_unreachable";
	try {
		setDefaultResultOrder("ipv4first");
	} catch {
		// DNS order is only a hint; the IPv4 fetch agent is the real switch.
	}
	neonConfig.fetchFunction = (url: string | URL, init?: RequestInit) => {
		return undiciFetch(url, { ...init, dispatcher: ipv4Agent });
	};
}

function restoreDefaultTransport(): void {
	usingIpv4 = false;
	neonConfig.fetchFunction = fetch;
}

async function withConnectRetry<T>(fn: () => Promise<T>): Promise<T> {
	const probingIpv6 = usingIpv4 && !preferIpv4();
	if (probingIpv6) {
		restoreDefaultTransport();
	}
	try {
		const result = await fn();
		if (probingIpv6) {
			transportNotice = null;
		}
		return result;
	} catch (error) {
		if (preferIpv4() || !isConnectFailure(error)) {
			throw error;
		}
		switchToIpv4();
		return await fn();
	}
}

export type HttpDatabase = ReturnType<typeof openHttpDb>;
export type AppDatabase = ReturnType<typeof createDb>;

export async function withDb<T>(
	connectionString: string,
	fn: (db: HttpDatabase) => Promise<T>,
): Promise<T> {
	return withConnectRetry(() => fn(createHttpDb(connectionString)));
}

export async function withTx<T>(
	connectionString: string,
	fn: (tx: Parameters<Parameters<AppDatabase["transaction"]>[0]>[0]) => Promise<T>,
): Promise<T> {
	return withConnectRetry(async () => {
		const pool = createPool(connectionString);
		const db = createDb(pool);
		try {
			return await db.transaction(fn);
		} finally {
			await pool.end();
		}
	});
}
