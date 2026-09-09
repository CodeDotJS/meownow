import { expect, test } from "vitest";
import { ABOUT_FAQ, ABOUT_FAQ_COL, ABOUT_FAQ_TITLE, ABOUT_FLOW } from "./about-copy";

function allCopy(): string {
	return [
		...ABOUT_FLOW.map((step) => `${step.title} ${step.body}`),
		ABOUT_FAQ_TITLE,
		...ABOUT_FAQ.map((row) => `${row.q} ${row.a}`),
	]
		.join("\n")
		.toLowerCase();
}

test("does not say vault on a guest about page", () => {
	expect(allCopy().includes("vault")).toBe(false);
});

test("keeps the original join topics as questions", () => {
	expect(ABOUT_FAQ.map((row) => row.id)).toEqual(
		expect.arrayContaining(["about-in", "about-passkey", "about-pair", "about-words", "about-ttl"]),
	);
	expect(ABOUT_FAQ.find((row) => row.id === "about-in")?.q).toMatch(/get in/i);
	expect(ABOUT_FAQ.find((row) => row.id === "about-in")?.a).toMatch(/this browser/i);
	expect(ABOUT_FAQ.find((row) => row.id === "about-in")?.a).toMatch(/image/i);
	expect(ABOUT_FAQ.find((row) => row.id === "about-passkey")?.a).toMatch(/passkey/i);
	expect(ABOUT_FAQ.find((row) => row.id === "about-words")?.a).toMatch(/twelve words/i);
});

test("does not claim same Wi-Fi is a LAN path", () => {
	const path = ABOUT_FLOW.find((step) => step.id === "flow-path");
	expect(path?.body).toMatch(/not just the same Wi/);
	expect(path?.body).toMatch(/hub/);
	expect(ABOUT_FAQ.some((row) => row.id === "about-local" && /No/.test(row.a))).toBe(true);
});

test("names live-only delivery and real TTLs", () => {
	const copy = allCopy();
	expect(copy).toMatch(/live only/);
	expect(copy).toMatch(/thirty days/);
	expect(copy).toMatch(/seven/);
	expect(copy).not.toMatch(/\bpin\b/);
	expect(ABOUT_FAQ.find((row) => row.id === "about-ttl")?.a).toMatch(/images and files/i);
	expect(ABOUT_FAQ.find((row) => row.id === "about-ttl")?.a).toMatch(/deadline/i);
	expect(ABOUT_FAQ.find((row) => row.id === "about-ttl")?.a).toMatch(/Reset deadlines/);
	expect(
		ABOUT_FAQ.some((row) => row.id === "about-live" && /skip the store/.test(row.a.toLowerCase())),
	).toBe(true);
});

test("splits unique questions into two equal columns", () => {
	const ids = ABOUT_FAQ.map((row) => row.id);
	const questions = ABOUT_FAQ.map((row) => row.q);
	expect(new Set(ids).size).toBe(ids.length);
	expect(new Set(questions).size).toBe(questions.length);
	expect(ABOUT_FAQ_COL).toBe(10);
	expect(ABOUT_FAQ).toHaveLength(20);
	expect(ABOUT_FAQ).toHaveLength(ABOUT_FAQ_COL * 2);
	expect(ABOUT_FAQ.find((row) => row.id === "about-leave")?.a).toMatch(/delete/i);
	expect(ABOUT_FAQ.find((row) => row.id === "about-sync")?.a).toMatch(/this browser/i);
	expect(ABOUT_FAQ.find((row) => row.id === "about-sync")?.a).toMatch(/queues/i);
	expect(ABOUT_FAQ.find((row) => row.id === "about-offline")?.a).toMatch(/local cache/i);
	expect(ABOUT_FAQ.find((row) => row.id === "about-offline")?.a).toMatch(/once online/i);
	expect(ABOUT_FAQ.find((row) => row.id === "about-offline")?.a).toMatch(
		/already have the clipboard/i,
	);
	expect(ABOUT_FAQ.find((row) => row.id === "about-others")?.a).toMatch(/^No/);
	expect(ABOUT_FAQ.find((row) => row.id === "about-upload")?.a).toMatch(/25 to 100/i);
	expect(ABOUT_FAQ.find((row) => row.id === "about-install")?.a).toMatch(/install/i);
	expect(ABOUT_FAQ.find((row) => row.id === "about-install")?.a).toMatch(/reload/i);
	expect(ABOUT_FAQ.find((row) => row.id === "about-share")?.a).toMatch(/android/i);
	expect(ABOUT_FAQ.find((row) => row.id === "about-kinds")?.a).toMatch(/markdown/i);
	expect(ABOUT_FAQ.find((row) => row.id === "about-kinds")?.a).toMatch(/ciphertext/i);
	expect(ABOUT_FAQ.find((row) => row.id === "about-kinds")?.a).toMatch(/paste a photo/i);
	expect(ABOUT_FAQ.find((row) => row.id === "about-two")?.a).toMatch(/⌘\\/);
	expect(ABOUT_FAQ.find((row) => row.id === "about-sync")?.a).toMatch(/panes/i);
	expect(ABOUT_FAQ.find((row) => row.id === "about-sync")?.a).toMatch(/Reset deadlines/);
});

test("says the server cannot read plaintext", () => {
	expect(allCopy()).toMatch(/ciphertext|seals the text/);
	expect(ABOUT_FAQ.some((row) => row.id === "about-read" && /^No/.test(row.a))).toBe(true);
	expect(ABOUT_FAQ.some((row) => row.id === "about-watch" && /cannot watch/.test(row.a))).toBe(
		true,
	);
	expect(ABOUT_FAQ.find((row) => row.id === "about-arrive")?.a).toMatch(/not the paste/i);
});
