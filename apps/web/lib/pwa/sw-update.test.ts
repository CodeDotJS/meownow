import { expect, test } from "vitest";
import {
	markSwReloaded,
	reloadForSwUpdate,
	SW_RELOAD_FLAG,
	SW_UPDATE_POLL_MS,
	shouldOfferSwUpdate,
	takeSwReloaded,
	watchSwUpdate,
} from "./sw-update";

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

test("Reload tells the waiting worker to skip and does not reload twice", () => {
	const posted: unknown[] = [];
	const waiting = {
		...stubWorker("installed"),
		postMessage(data: unknown) {
			posted.push(data);
		},
	};
	const store: Record<string, string> = {};
	let reloads = 0;
	const controllerListeners: Array<() => void> = [];
	reloadForSwUpdate(
		{
			installing: null,
			waiting,
			addEventListener() {},
			removeEventListener() {},
			update: async () => undefined,
		},
		{
			storage: {
				getItem: (key) => store[key] ?? null,
				setItem: (key, value) => {
					store[key] = value;
				},
				removeItem: (key) => {
					delete store[key];
				},
			},
			reload: () => {
				reloads += 1;
			},
			listenController: (fn) => {
				controllerListeners.push(fn);
			},
			delay: (fn) => {
				fn();
			},
		},
	);
	expect(posted).toEqual([{ type: "SKIP_WAITING" }]);
	expect(store[SW_RELOAD_FLAG]).toBe("1");
	expect(reloads).toBe(1);
	for (const listener of controllerListeners) {
		listener();
	}
	expect(reloads).toBe(1);
});

test("a page that just reloaded does not offer the leftover waiting worker", () => {
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
			undefined,
			{ ignoreCurrent: true },
		);
		expect(ready).toBe(false);
		stop();
	});
});

test("after a reload, a later installing worker can still ask", () => {
	withDom(() => {
		const installing = stubWorker("installing");
		const found: Array<() => void> = [];
		const live = {
			installing: null as ReturnType<typeof stubWorker> | null,
			waiting: stubWorker("installed"),
			addEventListener(_type: "updatefound", listener: () => void) {
				found.push(listener);
			},
			removeEventListener() {},
			update: async () => undefined,
		};
		let later = false;
		const stop = watchSwUpdate(
			live,
			true,
			() => {
				later = true;
			},
			undefined,
			{ ignoreCurrent: true },
		);
		expect(later).toBe(false);
		live.installing = installing;
		for (const listener of found) {
			listener();
		}
		expect(later).toBe(false);
		installing.state = "installed";
		installing.fire();
		expect(later).toBe(true);
		stop();
	});
});

test("controllerchange after Reload is not another offer", () => {
	withDom(() => {
		const listeners: Array<() => void> = [];
		const container = {
			addEventListener(_type: "controllerchange", listener: () => void) {
				listeners.push(listener);
			},
			removeEventListener() {},
		};
		let ready = false;
		const stop = watchSwUpdate(
			{
				installing: null,
				waiting: null,
				addEventListener() {},
				removeEventListener() {},
				update: async () => undefined,
			},
			true,
			() => {
				ready = true;
			},
			container,
			{ ignoreCurrent: true },
		);
		for (const listener of listeners) {
			listener();
		}
		expect(ready).toBe(false);
		stop();
	});
});

test("takeSwReloaded is one-shot", () => {
	const store: Record<string, string> = {};
	const storage = {
		getItem: (key: string) => store[key] ?? null,
		setItem: (key: string, value: string) => {
			store[key] = value;
		},
		removeItem: (key: string) => {
			delete store[key];
		},
	};
	markSwReloaded(storage);
	expect(takeSwReloaded(storage)).toBe(true);
	expect(takeSwReloaded(storage)).toBe(false);
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
