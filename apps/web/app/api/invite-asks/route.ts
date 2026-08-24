import { authHandlers } from "@/lib/auth/server";

export async function GET(request: Request) {
	return authHandlers().getInviteAsks(request);
}

export async function POST(request: Request) {
	return authHandlers().postInviteAsk(request);
}
