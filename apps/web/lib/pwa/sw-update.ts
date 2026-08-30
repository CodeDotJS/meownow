export const SW_UPDATE_POLL_MS = 60 * 60 * 1000;
export const SW_RELOAD_FLAG = "meownow.sw-reloaded";
export const SKIP_WAITING_MESSAGE = { type: "SKIP_WAITING" } as const;

type FlagStorage = {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
};

function sessionFlagStore(): FlagStorage | null {
	try {
		return sessionStorage;
	} catch {
		return null;
	}
}

export function markSwReloaded(storage: FlagStorage | null = sessionFlagStore()): void {
	storage?.setItem(SW_RELOAD_FLAG, "1");
}

export function takeSwReloaded(storage: FlagStorage | null = sessionFlagStore()): boolean {
	if (storage?.getItem(SW_RELOAD_FLAG) !== "1") {
		return false;
	}
	storage.removeItem(SW_RELOAD_FLAG);
	return true;
}

/** A first install must not nag. An update of a controlling worker should. */
export function shouldOfferSwUpdate(hadController: boolean, state: string): boolean {
	if (!hadController) {
		return false;
	}
	return state === "installed" || state === "activating" || state === "activated";
}

type SwLike = {
	state: string;
	postMessage?(data: unknown): void;
	addEventListener(type: "statechange", listener: () => void): void;
	removeEventListener(type: "statechange", listener: () => void): void;
};

export type SwRegistrationLike = {
	installing: SwLike | null;
	waiting: SwLike | null;
	addEventListener(type: "updatefound", listener: () => void): void;
	removeEventListener(type: "updatefound", listener: () => void): void;
	update(): Promise<unknown>;
};

export type SwContainerLike = {
	addEventListener(type: "controllerchange", listener: () => void): void;
	removeEventListener(type: "controllerchange", listener: () => void): void;
};

export type WatchSwUpdateOptions = {
	/** After Reload, ignore the worker we just asked to take over. */
	ignoreCurrent?: boolean;
};

export type ReloadForSwUpdateRuntime = {
	storage?: FlagStorage | null;
	reload?: () => void;
	listenController?: (fn: () => void) => void;
	delay?: (fn: () => void, ms: number) => void;
};

function watchWorker(
	worker: SwLike | null,
	hadController: boolean,
	onReady: () => void,
): () => void {
	if (!worker) {
		return () => undefined;
	}
	const check = () => {
		if (shouldOfferSwUpdate(hadController, worker.state)) {
			onReady();
		}
	};
	check();
	worker.addEventListener("statechange", check);
	return () => worker.removeEventListener("statechange", check);
}

/** Activate the waiting worker, then reload once. */
export function reloadForSwUpdate(
	registration: SwRegistrationLike,
	runtime: ReloadForSwUpdateRuntime = {},
): void {
	markSwReloaded(runtime.storage ?? sessionFlagStore());
	registration.waiting?.postMessage?.(SKIP_WAITING_MESSAGE);
	let done = false;
	const once = () => {
		if (done) {
			return;
		}
		done = true;
		(runtime.reload ?? (() => window.location.reload()))();
	};
	if (runtime.listenController) {
		runtime.listenController(once);
	} else if (typeof navigator !== "undefined" && navigator.serviceWorker) {
		navigator.serviceWorker.addEventListener("controllerchange", once);
	}
	(runtime.delay ?? ((fn, ms) => window.setTimeout(fn, ms)))(once, 350);
}

/** Call `update()` when the tab wakes, and watch the installing worker. */
export function watchSwUpdate(
	registration: SwRegistrationLike,
	hadController: boolean,
	onReady: () => void,
	container?: SwContainerLike | null,
	options?: WatchSwUpdateOptions,
): () => void {
	const stops: Array<() => void> = [];
	let armed = !options?.ignoreCurrent;
	if (armed) {
		stops.push(watchWorker(registration.waiting, hadController, onReady));
		stops.push(watchWorker(registration.installing, hadController, onReady));
	}

	const onFound = () => {
		armed = true;
		stops.push(watchWorker(registration.installing, hadController, onReady));
	};
	registration.addEventListener("updatefound", onFound);
	stops.push(() => registration.removeEventListener("updatefound", onFound));

	if (container) {
		const onController = () => {
			if (armed && hadController) {
				onReady();
			}
		};
		container.addEventListener("controllerchange", onController);
		stops.push(() => container.removeEventListener("controllerchange", onController));
	}

	const poke = () => {
		void registration.update().catch(() => undefined);
	};
	const onWake = () => {
		if (document.visibilityState === "visible") {
			poke();
		}
	};
	document.addEventListener("visibilitychange", onWake);
	window.addEventListener("online", poke);
	const tick = window.setInterval(poke, SW_UPDATE_POLL_MS);
	poke();
	stops.push(() => {
		document.removeEventListener("visibilitychange", onWake);
		window.removeEventListener("online", poke);
		window.clearInterval(tick);
	});
	return () => {
		for (const stop of stops) {
			stop();
		}
	};
}
