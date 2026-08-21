import { expect, test } from "vitest";
import { handleRequest } from "./http";

test("GET / returns 200 and meownow-edge", async () => {
	const response = await handleRequest(new Request("https://edge.meownow.test/"));
	expect(response.status).toBe(200);
	expect(await response.text()).toBe("meownow-edge");
});
