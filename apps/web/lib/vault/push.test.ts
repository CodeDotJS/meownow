import { expect, test } from "vitest";
import { pushSubject } from "./push";

test("push subject only accepts what web-push allows", () => {
	expect(pushSubject("https://meownow.app")).toBe("https://meownow.app");
	expect(pushSubject("mailto:hi@meownow.app")).toBe("mailto:hi@meownow.app");
	// An http APP_URL used to throw and fail the item write on localhost.
	expect(pushSubject("http://localhost:3000")).toBeNull();
	expect(pushSubject(undefined)).toBeNull();
});
