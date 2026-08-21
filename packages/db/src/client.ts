import { neon, neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema";

export function websocketConstructor(): typeof WebSocket {
	if (typeof globalThis.WebSocket === "function") {
		return globalThis.WebSocket;
	}
	return ws as unknown as typeof WebSocket;
}

export function createHttpDb(connectionString: string) {
	const sql = neon(connectionString);
	return drizzleHttp({ client: sql, schema });
}

export function createPool(connectionString: string): Pool {
	neonConfig.webSocketConstructor = websocketConstructor();
	return new Pool({ connectionString });
}

export function createDb(pool: Pool) {
	return drizzle({ client: pool, schema });
}

export type HttpDatabase = ReturnType<typeof createHttpDb>;
export type AppDatabase = ReturnType<typeof createDb>;

export async function withDb<T>(
	connectionString: string,
	fn: (db: HttpDatabase) => Promise<T>,
): Promise<T> {
	return fn(createHttpDb(connectionString));
}

export async function withTx<T>(
	connectionString: string,
	fn: (tx: Parameters<Parameters<AppDatabase["transaction"]>[0]>[0]) => Promise<T>,
): Promise<T> {
	const pool = createPool(connectionString);
	const db = createDb(pool);
	try {
		return await db.transaction(fn);
	} finally {
		await pool.end();
	}
}
