import { expect, test } from "vitest";
import { splitTaskMarks } from "./task-mark";

test("turns [ ] and [x] into boxes and leaves the rest as text", () => {
	expect(splitTaskMarks("[ ] open")).toEqual([
		{ type: "box", checked: false, at: 0 },
		{ type: "text", value: " open", at: 3 },
	]);
	expect(splitTaskMarks("[x] done and [X] too")).toEqual([
		{ type: "box", checked: true, at: 0 },
		{ type: "text", value: " done and ", at: 3 },
		{ type: "box", checked: true, at: 13 },
		{ type: "text", value: " too", at: 16 },
	]);
	expect(splitTaskMarks("plain")).toEqual([{ type: "text", value: "plain", at: 0 }]);
	expect(splitTaskMarks("[nope]")).toEqual([{ type: "text", value: "[nope]", at: 0 }]);
});
