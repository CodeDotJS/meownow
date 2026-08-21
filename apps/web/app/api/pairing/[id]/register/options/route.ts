import { authHandlers } from "@/lib/auth/server";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
	const { id } = await context.params;
	return authHandlers().postPairingRegisterOptions(request, id);
}
