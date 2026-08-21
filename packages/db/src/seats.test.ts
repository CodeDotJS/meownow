import { expect, test } from "vitest";
import { CLAIM_SEAT_SQL, claimSeat, parseSeatReturning } from "./seats";

test("claim SQL locks a free seat and never counts users", () => {
	expect(CLAIM_SEAT_SQL).toMatch(/for update skip locked/i);
	expect(CLAIM_SEAT_SQL.toLowerCase()).not.toContain("count(");
	expect(CLAIM_SEAT_SQL.toLowerCase()).not.toContain("count (*");
});

test("empty returning set means the cap is full", () => {
	expect(parseSeatReturning({ rows: [] })).toBeNull();
	expect(parseSeatReturning([])).toBeNull();
	expect(parseSeatReturning({ rows: [{ seat_no: 4 }] })).toBe(4);
});

test("claimSeat returns null when the executor yields zero rows", async () => {
	let rendered = "";
	const seat = await claimSeat(
		{
			execute: async (query) => {
				rendered = sqlText(query);
				return { rows: [] };
			},
		},
		"11111111-1111-1111-1111-111111111111",
	);
	expect(seat).toBeNull();
	expect(rendered.toLowerCase()).toContain("skip locked");
	expect(rendered.toLowerCase()).not.toContain("count(");
});

function sqlText(query: unknown): string {
	if (query && typeof query === "object" && "queryChunks" in query) {
		return JSON.stringify((query as { queryChunks: unknown }).queryChunks);
	}
	return JSON.stringify(query);
}
