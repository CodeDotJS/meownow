import { z } from "zod";

const postgresUrl = z
	.string()
	.min(1)
	.refine((value) => /^postgres(ql)?:\/\//.test(value), {
		message: "DATABASE_URL must be a postgres URL",
	});

export const dbEnvSchema = z.object({
	DATABASE_URL: postgresUrl,
	SEED_ADMIN_HANDLE: z.string().min(1).optional(),
	SEED_ADMIN_DISPLAY_NAME: z.string().min(1).optional(),
});

export const webEnvSchema = z.object({
	DATABASE_URL: postgresUrl,
	APP_URL: z.string().url(),
	SESSION_SECRET: z.string().min(32),
	ADMIN_ENROLL_SECRET: z.string().min(16),
	HUB_SECRET: z.string().min(32).optional(),
	EDGE_URL: z.string().url().optional(),
	SENTRY_DSN: z.string().url().optional(),
	VAPID_PUBLIC_KEY: z.string().min(1).optional(),
	VAPID_PRIVATE_KEY: z.string().min(1).optional(),
	VAPID_SUBJECT: z
		.string()
		.min(1)
		.refine((value) => value.startsWith("mailto:") || /^https?:\/\//.test(value), {
			message: "VAPID_SUBJECT must be a mailto: or https: URL",
		})
		.optional(),
	CAPABILITY_TOKEN_PUBLIC_KEY: z.string().min(1).optional(),
});

export const edgeEnvSchema = z.object({
	HUB: z.unknown(),
	BLOBS: z.unknown(),
	HUB_SECRET: z.string().min(32),
	APP_URL: z.string().url(),
});

export type DbEnv = z.infer<typeof dbEnvSchema>;
export type WebEnv = z.infer<typeof webEnvSchema>;
export type EdgeEnv = z.infer<typeof edgeEnvSchema>;

export function parseDbEnv(env: unknown): DbEnv {
	return dbEnvSchema.parse(env);
}

export function parseWebEnv(env: unknown): WebEnv {
	return webEnvSchema.parse(env);
}

export function parseEdgeEnv(env: unknown): EdgeEnv {
	return edgeEnvSchema.parse(env);
}
