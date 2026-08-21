import { authHandlers } from "@/lib/auth/server";

export async function GET(request: Request) {
	return authHandlers().getItems(request);
}

export async function POST(request: Request) {
	return authHandlers().postItem(request);
}
