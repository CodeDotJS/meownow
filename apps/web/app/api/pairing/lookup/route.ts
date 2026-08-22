import { authHandlers } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
	return authHandlers().postPairingLookup(request);
}
