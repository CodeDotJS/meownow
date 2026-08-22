import { expect, test } from "vitest";
import { hubOrigin } from "./hub";

test("hubOrigin prefers HUB_URL so a local app can join the production room", () => {
	expect(hubOrigin({ EDGE_URL: "http://localhost:8787" })).toBe("http://localhost:8787");
	expect(
		hubOrigin({
			EDGE_URL: "http://localhost:8787",
			HUB_URL: "https://meownow-edge.example",
		}),
	).toBe("https://meownow-edge.example");
	expect(hubOrigin({})).toBeUndefined();
});
