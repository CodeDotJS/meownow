import { type SQL, sql } from "drizzle-orm";

export const CLAIM_SEAT_SQL = [
	"update seats set user_id = $1, claimed_at = now()",
	"where seat_no = (select seat_no from seats where user_id is null",
	"order by seat_no limit 1 for update skip locked)",
	"returning seat_no",
].join(" ");

export function claimSeatQuery(userId: string): SQL {
	return sql`
		update seats set user_id = ${userId}, claimed_at = now()
		where seat_no = (
			select seat_no from seats where user_id is null
			order by seat_no limit 1 for update skip locked
		)
		returning seat_no
	`;
}

export function parseSeatReturning(result: unknown): number | null {
	const rows = extractRows(result);
	const row = rows[0];
	if (!row || typeof row !== "object") {
		return null;
	}
	const record = row as Record<string, unknown>;
	const seat = record.seat_no ?? record.seatNo;
	if (typeof seat === "number" && Number.isInteger(seat)) {
		return seat;
	}
	if (typeof seat === "string" && seat !== "") {
		const parsed = Number(seat);
		return Number.isInteger(parsed) ? parsed : null;
	}
	return null;
}

export async function claimSeat(
	tx: { execute: (query: SQL) => Promise<unknown> },
	userId: string,
): Promise<number | null> {
	const result = await tx.execute(claimSeatQuery(userId));
	return parseSeatReturning(result);
}

function extractRows(result: unknown): unknown[] {
	if (Array.isArray(result)) {
		return result;
	}
	if (result && typeof result === "object" && "rows" in result) {
		const rows = (result as { rows: unknown }).rows;
		if (Array.isArray(rows)) {
			return rows;
		}
	}
	return [];
}
