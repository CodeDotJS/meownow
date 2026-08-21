import { authHandlers } from "@/lib/auth/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	return authHandlers().postAdminRemoveUser(request, id);
}
