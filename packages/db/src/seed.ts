import { pathToFileURL } from "node:url";
import { parseDbEnv } from "@meownow/config/env";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { seats, users } from "./schema";

export const SEAT_COUNT = 10;
export const DEFAULT_QUOTA_BYTES = 524_288_000;

export function seatNumbers(): number[] {
	return Array.from({ length: SEAT_COUNT }, (_, i) => i + 1);
}

export type AdminSeedInput = {
	SEED_ADMIN_HANDLE?: string;
	SEED_ADMIN_DISPLAY_NAME?: string;
};

export function adminSeed(env: AdminSeedInput) {
	return {
		handle: env.SEED_ADMIN_HANDLE ?? "rishi",
		displayName: env.SEED_ADMIN_DISPLAY_NAME ?? "Rishi",
		role: "admin" as const,
		canUpload: true,
		storageQuotaBytes: DEFAULT_QUOTA_BYTES,
	};
}

export async function seedDatabase(): Promise<void> {
	const env = parseDbEnv(process.env);
	neonConfig.webSocketConstructor = ws;
	const pool = new Pool({ connectionString: env.DATABASE_URL });
	const db = drizzle({ client: pool });
	const admin = adminSeed(env);

	try {
		await db.transaction(async (tx) => {
			const existing = await tx.select().from(users).where(eq(users.handle, admin.handle)).limit(1);
			let userId = existing[0]?.id;
			if (!userId) {
				const inserted = await tx
					.insert(users)
					.values({
						handle: admin.handle,
						displayName: admin.displayName,
						role: admin.role,
						canUpload: admin.canUpload,
						storageQuotaBytes: admin.storageQuotaBytes,
					})
					.returning({ id: users.id });
				userId = inserted[0]?.id;
				if (!userId) {
					throw new Error("failed to insert admin");
				}
			}

			for (const seatNo of seatNumbers()) {
				await tx.insert(seats).values({ seatNo }).onConflictDoNothing({ target: seats.seatNo });
			}

			await tx.update(seats).set({ userId, claimedAt: new Date() }).where(eq(seats.seatNo, 1));
		});
	} finally {
		await pool.end();
	}
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
	await seedDatabase();
}
