import { neonConfig } from "@neondatabase/serverless";
import { afterEach, expect, test } from "vitest";
import { createHttpDb, websocketConstructor } from "./client";

const previous = neonConfig.webSocketConstructor;

afterEach(() => {
	neonConfig.webSocketConstructor = previous;
});

test("createHttpDb returns a drizzle client without opening a pool", () => {
	const db = createHttpDb("postgresql://user:pass@localhost:5432/meownow");
	expect(db.query).toBeTypeOf("object");
});

test("websocketConstructor prefers the platform WebSocket when present", () => {
	expect(websocketConstructor()).toBe(globalThis.WebSocket);
});
