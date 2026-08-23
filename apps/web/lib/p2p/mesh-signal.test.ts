import { expect, test } from "vitest";
import { planRtcSignal } from "./mesh-signal";

test("an offer is applied only while stable", () => {
	expect(planRtcSignal("stable", "offer")).toBe("apply-offer");
	expect(planRtcSignal("have-remote-offer", "offer")).toBe("ignore");
	expect(planRtcSignal("have-local-offer", "offer")).toBe("ignore");
	expect(planRtcSignal("stable", "offer", true)).toBe("ignore");
});

test("an answer is applied only after we offered", () => {
	expect(planRtcSignal("have-local-offer", "answer")).toBe("apply-answer");
	expect(planRtcSignal("stable", "answer")).toBe("ignore");
	expect(planRtcSignal("have-remote-offer", "answer")).toBe("ignore");
});
