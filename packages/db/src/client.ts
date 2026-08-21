import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema";

export function createPool(connectionString: string): Pool {
	neonConfig.webSocketConstructor = ws;
	return new Pool({ connectionString });
}

export function createDb(pool: Pool) {
	return drizzle({ client: pool, schema });
}

export type AppDatabase = ReturnType<typeof createDb>;

export async function withDb<T>(
	connectionString: string,
	fn: (db: AppDatabase) => Promise<T>,
): Promise<T> {
	const pool = createPool(connectionString);
	const db = createDb(pool);
	try {
		return await fn(db);
	} finally {
		await pool.end();
	}
}
