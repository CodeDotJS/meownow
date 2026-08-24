import { authHandlers } from "@/lib/auth/server";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
	const { id } = await context.params;
	return authHandlers().deleteInviteAsk(request, id);
}
