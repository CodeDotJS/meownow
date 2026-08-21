import { authHandlers } from "@/lib/auth/server";

export async function GET(request: Request) {
	return authHandlers().getAdminUsage(request);
}
