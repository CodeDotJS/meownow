import { authHandlers } from "@/lib/auth/server";

export async function POST(request: Request) {
	return authHandlers().postUploadIntent(request);
}
