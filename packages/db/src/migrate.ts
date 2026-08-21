import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseDbEnv } from "@meownow/config/env";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const env = parseDbEnv(process.env);
const sql = neon(env.DATABASE_URL);
const db = drizzle({ client: sql });
const migrationsFolder = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
	"migrations",
);

await migrate(db, { migrationsFolder });
