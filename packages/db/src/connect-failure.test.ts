import { expect, test } from "vitest";
import { isConnectFailure } from "./connect-failure";

test("isConnectFailure matches Neon HTTP connect timeouts", () => {
	const error = Object.assign(new Error("Error connecting to database: fetch failed"), {
		cause: Object.assign(new Error("Connect Timeout Error"), {
			code: "UND_ERR_CONNECT_TIMEOUT",
			cause: Object.assign(new Error(""), { code: "ETIMEDOUT" }),
		}),
	});
	expect(isConnectFailure(error)).toBe(true);
});

test("isConnectFailure matches an unreachable IPv6 hop", () => {
	expect(isConnectFailure(Object.assign(new Error("connect"), { code: "ENETUNREACH" }))).toBe(true);
});

test("isConnectFailure ignores query errors", () => {
	expect(isConnectFailure(Object.assign(new Error("duplicate key"), { code: "23505" }))).toBe(
		false,
	);
});
