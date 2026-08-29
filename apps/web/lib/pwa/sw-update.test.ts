import { expect, test } from "vitest";
import { SW_UPDATE_POLL_MS, shouldOfferSwUpdate, watchSwUpdate } from "./sw-update";

type WorkerStub = {
	state: string;
	addEventListener(type: "statechange", listener: () => void): void;
	removeEventListener(type: "statechange", listener: () => void): void;
};

function stubWorker(state: string): WorkerStub & { fire(): void } {
	const listeners: Array<() => void> = [];
	return {
		state,
		addEventListener(_type, listener) {
			listeners.push(listener);
		},
		removeEventListener(_type, listener) {
			const at = listeners.indexOf(listener);
			if (at >= 0) {
				listeners.splice(at, 1);
			}
		},
		fire() {
			for (const listener of listeners) {
				listener();
			}
		},
	};
}

function withDom(run: () => void): void {
	const documentStub = {
		visibilityState: "visible",
		addEventListener() {},
		removeEventListener() {},
	};
	const windowStub = {
		addEventListener() {},
		removeEventListener() {},
		setInterval: () => 1,
		clearInterval() {},
	};
	const prevDocument = globalThis.document;
	const prevWindow = globalThis.window;
	Object.defineProperty(globalThis, "document", { configurable: true, value: documentStub });
	Object.defineProperty(globalThis, "window", { configurable: true, value: windowStub });
	try {
		run();
	} finally {
		Object.defineProperty(globalThis, "document", { configurable: true, value: prevDocument });
		Object.defineProperty(globalThis, "window", { configurable: true, value: prevWindow });
	}
}

test("first install does not ask for a reload", () => {
	expect(shouldOfferSwUpdate(false, "installed")).toBe(false);
	expect(shouldOfferSwUpdate(false, "activated")).toBe(false);
});

test("a new worker on a controlled page is ready to reload", () => {
	expect(shouldOfferSwUpdate(true, "installing")).toBe(false);
	expect(shouldOfferSwUpdate(true, "installed")).toBe(true);
	expect(shouldOfferSwUpdate(true, "activating")).toBe(true);
	expect(shouldOfferSwUpdate(true, "activated")).toBe(true);
});

test("update checks are hourly, not every few seconds", () => {
	expect(SW_UPDATE_POLL_MS).toBe(60 * 60 * 1000);
});

test("watchSwUpdate does not nag on a first install", () => {
	withDom(() => {
		let ready = false;
		const stop = watchSwUpdate(
			{
				installing: null,
				waiting: stubWorker("installed"),
				addEventListener() {},
				removeEventListener() {},
				update: async () => undefined,
			},
			false,
			() => {
				ready = true;
			},
		);
		expect(ready).toBe(false);
		stop();
	});
});

test("watchSwUpdate offers when a waiting worker is already installed", () => {
	withDom(() => {
		let ready = false;
		const stop = watchSwUpdate(
			{
				installing: null,
				waiting: stubWorker("installed"),
				addEventListener() {},
				removeEventListener() {},
				update: async () => undefined,
			},
			true,
			() => {
				ready = true;
			},
		);
		expect(ready).toBe(true);
		stop();
	});
});

test("controllerchange after clientsClaim is an update, not a first install", () => {
	withDom(() => {
		const listeners: Array<() => void> = [];
		const container = {
			addEventListener(_type: "controllerchange", listener: () => void) {
				listeners.push(listener);
			},
			removeEventListener() {},
		};
		const registration = {
			installing: null,
			waiting: null,
			addEventListener() {},
			removeEventListener() {},
			update: async () => undefined,
		};

		let first = false;
		const stopFirst = watchSwUpdate(
			registration,
			false,
			() => {
				first = true;
			},
			container,
		);
		for (const listener of listeners) {
			listener();
		}
		expect(first).toBe(false);
		stopFirst();

		listeners.length = 0;
		let update = false;
		const stopUpdate = watchSwUpdate(
			registration,
			true,
			() => {
				update = true;
			},
			container,
		);
		expect(update).toBe(false);
		for (const listener of listeners) {
			listener();
		}
		expect(update).toBe(true);
		stopUpdate();
	});
});

test("watchSwUpdate waits until the installing worker is installed", () => {
	withDom(() => {
		const installing = stubWorker("installing");
		let ready = false;
		const stop = watchSwUpdate(
			{
				installing,
				waiting: null,
				addEventListener() {},
				removeEventListener() {},
				update: async () => undefined,
			},
			true,
			() => {
				ready = true;
			},
		);
		expect(ready).toBe(false);
		installing.state = "installed";
		installing.fire();
		expect(ready).toBe(true);
		stop();
	});
});
