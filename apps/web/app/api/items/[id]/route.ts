import { authHandlers } from "@/lib/auth/server";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
	const { id } = await context.params;
	return authHandlers().patchItem(request, id);
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
	const { id } = await context.params;
	return authHandlers().deleteItem(request, id);
}
