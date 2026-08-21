import { z } from "zod";
import { itemKindSchema, wrappedKeyWireSchema } from "./vault";

export const dcEnvelopeSchema = z.discriminatedUnion("type", [
	z
		.object({
			v: z.literal(1),
			type: z.literal("item"),
			ephemeral: z.boolean(),
			item: z.object({
				id: z.string().uuid(),
				kind: itemKindSchema,
				ciphertext: z.string().min(1).optional(),
				metaCiphertext: z.string().min(1),
				iv: z.string().min(1),
				wrappedKey: wrappedKeyWireSchema.optional(),
				byteSize: z.number().int().nonnegative(),
				expiresAt: z.string(),
			}),
		})
		.strict(),
]);

export type DcEnvelope = z.infer<typeof dcEnvelopeSchema>;
