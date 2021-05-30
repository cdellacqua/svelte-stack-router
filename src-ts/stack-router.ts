import regexparam from 'regexparam';
import { tick } from 'svelte';
import { noop } from 'svelte/internal';
import {
	readable, derived, writable, get,
} from 'svelte/store';
import { noAnimation } from './transition-functions';
import {
	CacheEntry,
	ComponentConfig,
	Config,
	HistoryItem,
	HistoryState,
	NavigationType,
	LoadableEntryAction,
	UnloadableEntryAction,
	Routes,
} from './types';
import { dispatchCustomEvent, sleep } from './utils';

const config: Config = {
	defaultResumable: true,
	useHash: true,
	restoreScroll: true,
	routes: {},
	mountPoint: null,
	transitionFn: noAnimation(),
	dispatch: null,
};

const internalCache = writable<CacheEntry[]>([]);
/** Current component cache readable store */
export const cache = derived(internalCache, (x) => x);

/* LOCATION */
function getLocation(): string {
	if (config.useHash) {
		const hashIndex = window.location.href.indexOf('#/');
		const location = hashIndex > -1 ? window.location.href.substring(hashIndex + 1) : '/';
		return location;
	}
	const relativeUrl = (window.location.pathname || '/') + window.location.search;
	return relativeUrl;
}

// Used in the `pop` function to prevent a double trigger of the PopStateEvent
let ignorePopStateEvent = false;

/**
 * Readable store representing the current location
 */
export const location = readable(getLocation(), (set) => {
	let previousLocation: string | null = null;
	const handlePopState = async () => {
		if (ignorePopStateEvent) {
			return;
		}
		const newLocation = getLocation();
		if (previousLocation !== newLocation) {
			previousLocation = newLocation;
			set(newLocation);
		}
	};
	window.addEventListener('popstate', handlePopState);
	return function stop() {
		window.removeEventListener('popstate', handlePopState);
	};
});

/* PATHNAME */
function getPathname(location: string): string {
	const queryStringPosition = location.indexOf('?');
	if (queryStringPosition !== -1) {
		return location.substring(0, queryStringPosition);
	}
	return location;
}
/**
 * Readable store that contains the pathname part of the location
 */
export const pathname = derived(location, getPathname);

/* SEARCH */
function getSearch(location: string): string {
	const queryStringPosition = location.indexOf('?');
	if (queryStringPosition !== -1) {
		return location.substring(queryStringPosition);
	}
	return '';
}
/**
 * Readable store that contains the search part of the location
 */
export const search = derived(location, getSearch);

/* UTILS */
let lastHistoryTimestamp: number;
async function waitForHistoryState(callback: () => void): Promise<void> {
	const historyState = window.history.state;

	callback();

	// Wait for history.state to pick the current state (without this sleep history.state points to the previous state)
	// See https://developer.mozilla.org/en-US/docs/Web/API/Window/popstate_event
	let limit = 100;
	while (historyState === window.history.state && limit) {
		await sleep(2);
		limit--;
	}
	if (historyState === window.history.state) {
		console.warn('unable to detect history change');
	}
}

function buildParams(pathname: string, routeKey: string): Record<string, string | null> | undefined {
	const { pattern, keys } = regexparam(routeKey);
	const matches = pattern.exec(pathname) || [];
	const params = keys.reduce((params, _, index) => {
		params[keys[index]] = matches[index + 1] === undefined ? null : decodeURIComponent(matches[index + 1]);
		return params;
	}, {} as Record<string, string | null>);
	return Object.keys(params).length === 0 ? undefined : params;
}

/* LOCATION UPDATE CONSUMER */
const historyItemsQueue: HistoryItem[] = [];
let consumingQueue = false;
async function consumeQueue(): Promise<void> {
	if (consumingQueue) {
		return;
	}
	consumingQueue = true;
	while (historyItemsQueue.length > 0) {
		const item = historyItemsQueue.shift()!;
		await handleHistoryChange(item);
	}
	consumingQueue = false;
}

/* INIT & DESTROY */
let locationSubscription = noop;

export function updateConfig(initConfig: Partial<Omit<Config, 'mountPoint'>> & { routes: Routes }): void {
	(Object.keys(initConfig) as (keyof Omit<Config, 'mountPoint'>)[])
		.forEach((key) => {
			if (initConfig[key] !== undefined) {
				config[key] = initConfig[key] as any;
			}
		});

	if ('scrollRestoration' in window.history) {
		window.history.scrollRestoration = config.restoreScroll ? 'manual' : 'auto';
	}
}

export function handleStackRouterComponentMount(initConfig: Partial<Config> & { routes: Routes, mountPoint: HTMLDivElement }): void {
	updateConfig(initConfig);

	const firstRun = true;
	let previousState: HistoryState | null = null;
	locationSubscription = location
		.subscribe(
			async ($location) => {
				// Wait for history.state to pick the current state (without this sleep history.state can point to the previous state)
				// See https://developer.mozilla.org/en-US/docs/Web/API/Window/popstate_event
				let currentState = window.history.state;
				if (!firstRun && currentState !== undefined) {
					let limit = 100;
					while (previousState === currentState && limit) {
						await sleep(2);
						limit--;
						currentState = window.history.state;
					}
					if (previousState === currentState) {
						console.warn('unable to detect history change');
					}
				}
				historyItemsQueue.push({
					location: $location,
					state: currentState,
				});
				previousState = currentState;
				consumeQueue();
			},
		);
}

export function handleStackRouterComponentDestroy(): void {
	locationSubscription();
	internalCache.set([]);
	locationSubscription = noop;
	config.mountPoint = null;
	config.dispatch = null;
}

let editableEntryConfig: ComponentConfig | null = null;
async function prepareCacheEntryToActivate(cache: CacheEntry[], pathname: string): Promise<CacheEntry | CacheEntry | null> {
	const routeKeys = Object.keys(config.routes);
	const routeKey = routeKeys.find((routeKey) => {
		const { pattern } = regexparam(routeKey);
		return pattern.test(pathname);
	});
	if (routeKey === undefined || routeKey === null) {
		return null;
	}
	const params = buildParams(pathname, routeKey);

	const resumableEntry = cache.find(
		(s) => s.routeMatch === routeKey,
	);

	let entry: CacheEntry | undefined;
	if (resumableEntry) {
		editableEntryConfig = resumableEntry.entryConfig;
		entry = resumableEntry;

		if (resumableEntry.pathname !== pathname) {
			resumableEntry.componentInstance.$set({ params });
			resumableEntry.pathname = pathname;
		}
	} else {
		const mountPoint = document.createElement('div');

		editableEntryConfig = {
			resumable: config.defaultResumable,
		};
		entry = {
			component: config.routes[routeKey],
			componentInstance: new config.routes[routeKey]({ target: mountPoint, props: { params } }),
			mountPoint,
			pathname,
			routeMatch: routeKey,
			entryConfig: editableEntryConfig,
		};
	}

	await tick();

	editableEntryConfig = null;

	return entry;
}

let activeCacheEntry: CacheEntry | null = null;
async function handleHistoryChange(historyItem: HistoryItem): Promise<void> {
	const currentCache: CacheEntry[] = get(internalCache);

	const isNewHistoryItem = !historyItem.state;
	if (isNewHistoryItem) {
		historyItem.state = {
			timestamp: new Date().getTime(),
		};
		await waitForHistoryState(() => window.history.replaceState(historyItem.state, '', (config.useHash ? '#' : '') + historyItem.location));
	}

	const pageToLoad = await prepareCacheEntryToActivate(currentCache, getPathname(historyItem.location));
	if (!pageToLoad) {
		config.dispatch?.('error', {
			message: 'no route found',
			location: historyItem.location,
		});
		return;
	}
	const pageToUnload = activeCacheEntry;
	const newTopIndexInCurrentStack = currentCache.findIndex((s) => s.routeMatch === pageToLoad.routeMatch);

	let pageToLoadAction = LoadableEntryAction.NoOp;
	let pageToUnloadAction = UnloadableEntryAction.NoOp;
	let navigationType: NavigationType = NavigationType.GoForwardNewState;

	if (!pageToUnload) {
		pageToLoadAction = LoadableEntryAction.New;
	} else {
		if (pageToUnload.routeMatch !== pageToLoad.routeMatch) {
			if (newTopIndexInCurrentStack !== -1) {
				pageToLoadAction = LoadableEntryAction.Resume;
			} else {
				pageToLoadAction = LoadableEntryAction.New;
			}
			if (pageToUnload.entryConfig.resumable) {
				pageToUnloadAction = UnloadableEntryAction.Pause;
			} else {
				pageToUnloadAction = UnloadableEntryAction.Destroy;
			}
		}

		if (isNewHistoryItem) {
			navigationType = NavigationType.GoForwardNewState;
		} else if (historyItem.state.timestamp > lastHistoryTimestamp) {
			navigationType = NavigationType.GoForwardResumeState;
		} else if (historyItem.state.timestamp < lastHistoryTimestamp) {
			navigationType = NavigationType.GoBackward;
		} else {
			navigationType = NavigationType.Replace;
		}
	}

	config.dispatch?.('navigation-start', {
		location: historyItem.location,
		navigationType,
		pageToLoad,
		pageToUnload,
		pageToLoadAction,
		pageToUnloadAction,
	});

	// BEFORE TRANSITION
	async function beforeUnload() {
		if (
			pageToUnload
			&& pageToUnloadAction !== UnloadableEntryAction.NoOp
			&& pageToUnload.entryConfig.onBeforeUnload
			&& pageToUnload.entryConfig.onBeforeUnload.length > 0
		) {
			for (const callback of pageToUnload.entryConfig.onBeforeUnload) {
				await callback();
			}
		}
	}

	async function beforeLoad() {
		if (
			pageToLoad
			&& pageToLoadAction !== LoadableEntryAction.NoOp
			&& pageToLoad.entryConfig.onBeforeLoad
			&& pageToLoad.entryConfig.onBeforeLoad.length > 0
		) {
			for (const callback of pageToLoad.entryConfig.onBeforeLoad) {
				await callback();
			}
		}
	}

	await Promise.all([beforeUnload(), beforeLoad()]);

	// DURING TRANSITION
	async function pause() {
		if (
			pageToUnload
			&& pageToUnloadAction === UnloadableEntryAction.Pause
			&& pageToUnload.entryConfig.onPause
			&& pageToUnload.entryConfig.onPause.length > 0
		) {
			for (const callback of pageToUnload.entryConfig.onPause) {
				await callback();
			}
		}
	}

	async function resume() {
		if (pageToLoad && pageToLoadAction === LoadableEntryAction.Resume) {
			const { returnValue } = historyItem.state || {};
			await waitForHistoryState(() => {
				// Remove returnValue and scroll
				window.history.replaceState(
					{
						timestamp: historyItem.state.timestamp,
					} as HistoryState,
					'',
					(config.useHash ? '#' : '') + historyItem.location,
				);
			});
			if (pageToLoad.entryConfig.onResume && pageToLoad.entryConfig.onResume.length > 0) {
				for (const callback of pageToLoad.entryConfig.onResume) {
					await callback(returnValue);
				}
			}
		}
	}

	const oldTopMountPoint = pageToUnload ? pageToUnload.mountPoint : null;
	const newTopMountPoint = pageToLoad.mountPoint;

	if (oldTopMountPoint !== newTopMountPoint) {
		async function transition() {
			if (config.mountPoint) {
				if (!newTopMountPoint.parentElement) {
					config.mountPoint.appendChild(newTopMountPoint);
				}

				await config.transitionFn({
					navigationType,
					routerMountPoint: config.mountPoint,
					mountPointToLoad: newTopMountPoint,
					mountPointToUnload: oldTopMountPoint,
					scroll: historyItem.state.scroll || { x: 0, y: 0 },
				});

				if (oldTopMountPoint) {
					config.mountPoint.removeChild(oldTopMountPoint);
				}
			}
		}

		await Promise.all([
			transition(),
			pause(),
			resume(),
		]);
	}

	// AFTER TRANSITION
	async function afterLoad() {
		if (
			pageToLoad
			&& pageToLoadAction !== LoadableEntryAction.NoOp
			&& pageToLoad.entryConfig.onAfterLoad
			&& pageToLoad.entryConfig.onAfterLoad.length > 0
		) {
			for (const callback of pageToLoad.entryConfig.onAfterLoad) {
				await callback();
			}
		}
	}

	async function afterUnload() {
		if (
			pageToUnload
			&& pageToUnloadAction !== UnloadableEntryAction.NoOp
			&& pageToUnload.entryConfig.onAfterUnload
			&& pageToUnload.entryConfig.onAfterUnload.length > 0
		) {
			for (const callback of pageToUnload.entryConfig.onAfterUnload) {
				await callback();
			}
		}
	}

	await Promise.all([afterLoad(), afterUnload()]);

	if (pageToLoadAction === LoadableEntryAction.New) {
		currentCache.push(pageToLoad);
	}
	if (pageToUnload && pageToUnloadAction === UnloadableEntryAction.Destroy) {
		pageToUnload.componentInstance.$destroy();
		currentCache.splice(currentCache.indexOf(pageToUnload), 1);
	}
	internalCache.set(currentCache);
	activeCacheEntry = pageToLoad;

	lastHistoryTimestamp = historyItem.state.timestamp;

	config.dispatch?.('navigation-end', {
		location: historyItem.location,
		navigationType,
		pageToLoad,
		pageToUnload,
		pageToLoadAction,
		pageToUnloadAction,
	});
}

/* API FUNCTIONS */
/**
 * Replaces the current history location and state
 * @param location new location
 * @param state new history state
 */
export async function replace(location: string, state?: HistoryState): Promise<void> {
	await waitForHistoryState(() => {
		window.history.replaceState({
			...(state || {}),
			timestamp: lastHistoryTimestamp,
		},
		'',
		(config.useHash ? '#' : '') + location);
	});

	dispatchCustomEvent(window as any, 'popstate');
}

/**
 * Navigates to a new location
 * If scroll restoration is enabled, the current window scroll position is persisted before leaving the current location
 * If the new location equals the current one, this function won't modify the browser history
 * @param location new location
 */
export async function push(location: string): Promise<void> {
	if (location === getLocation()) {
		return;
	}

	if (config.restoreScroll) {
		await waitForHistoryState(() => {
			window.history.replaceState({
				timestamp: window.history.state ? window.history.state.timestamp : new Date().getTime(),
				scroll: {
					x: window.scrollY,
					y: window.scrollY,
				},
			}, '', (config.useHash ? '#' : '') + getLocation());
		});
	}

	await waitForHistoryState(() => {
		window.history.pushState(
			undefined,
			'',
			(config.useHash ? '#' : '') + location,
		);
	});

	dispatchCustomEvent(window as any, 'popstate');
}

/**
 * Navigates back
 * @param returnValue a serializable object that will be returned to the component associated with the previous location if resumable
 */
export async function pop(returnValue?: any): Promise<void> {
	ignorePopStateEvent = true;
	await waitForHistoryState(() => window.history.back());
	await waitForHistoryState(() => {
		window.history.replaceState(
			{
				...window.history.state || {},
				returnValue,
			},
			'',
			(config.useHash ? '#' : '') + getLocation(),
		);
	});
	ignorePopStateEvent = false;
	dispatchCustomEvent(window as any, 'popstate');
}

/**
 * Svelte action that can be associated with an HTMLAnchorElement (`<a>`) to automatically prefix '#' when using client side navigation only
 * @param node the HTML anchor tag
 * @param href the href attribute of the anchor tag
 * @returns an object containing the callback Svelte will use to trigger updates
 */
export function link(node: HTMLAnchorElement, href?: string): { update: Function } {
	if (!node || !node.tagName || node.tagName.toLowerCase() !== 'a') {
		throw new Error('not a <a> tag');
	}

	async function pushState(e: MouseEvent) {
		if (!e.ctrlKey) {
			e.preventDefault();
			// for an unknown reason, pushing the state blocks any on:click handler attached in a Svelte file.
			// This sleep lets the event propagate and schedules the push call after the bubbling has finished
			await sleep(1);
			push(config.useHash ? node.getAttribute('href')!.substring(1) : node.getAttribute('href')!);
		}
	}

	node.addEventListener('click', pushState);

	function hashHref(node: HTMLElement, href: string) {
		if (!href || href.length < 1 || href.charAt(0) !== '/') {
			throw new Error(`invalid href ${href}`);
		}

		node.setAttribute('href', `${config.useHash ? '#' : ''}${href}`);
	}

	hashHref(node, href || node.getAttribute('href')!);

	return {
		update(href: string) {
			hashHref(node, href);
		},
	};
}

/* COMPONENT LIFECYCLE */
const lifecycleErrorText = 'lifecycle functions can only be'
	+ ' called while initializing or before preparing a component to resume (i.e. with a reactive statement on "params")';

/**
 * Attaches a callback to the resume lifecycle phase.
 * Lifecycle summary (|| = semi-parallel execution, achieved with Promise.all):
 * - create the page component if not in cache
 * - before-unload previous component || before-load new component
 * - pause previous component if resumable || resume new component if in cache || animate-transition
 * - after-unload previous component || after-load new component
 * - destroy previous component if not resumable
 * @param callback function that will be called when the component is resumed
 */
export function onResume(callback: () => any): void {
	if (!editableEntryConfig) {
		throw new Error(lifecycleErrorText);
	}
	if (!editableEntryConfig.onResume) {
		editableEntryConfig.onResume = [];
	}
	editableEntryConfig.onResume.push(callback);
}

/**
 * Attaches a callback to the pause lifecycle phase.
 * Lifecycle summary (|| = semi-parallel execution, achieved with Promise.all):
 * - create the page component if not in cache
 * - before-unload previous component || before-load new component
 * - pause previous component if resumable || resume new component if in cache || animate-transition
 * - after-unload previous component || after-load new component
 * - destroy previous component if not resumable
 * @param callback function that will be called when the component is paused
 */
export function onPause(callback: () => any): void {
	if (!editableEntryConfig) {
		throw new Error(lifecycleErrorText);
	}
	if (!editableEntryConfig.onPause) {
		editableEntryConfig.onPause = [];
	}
	editableEntryConfig.onPause.push(callback);
}

/**
 * Attaches a callback to the before-unload lifecycle phase.
 * Lifecycle summary (|| = semi-parallel execution, achieved with Promise.all):
 * - create the page component if not in cache
 * - before-unload previous component || before-load new component
 * - pause previous component if resumable || resume new component if in cache || animate-transition
 * - after-unload previous component || after-load new component
 * - destroy previous component if not resumable
 * @param callback function that will be called when the component is being prepared for unloading
 */
export function onBeforeUnload(callback: () => any): void {
	if (!editableEntryConfig) {
		throw new Error(lifecycleErrorText);
	}
	if (!editableEntryConfig.onBeforeUnload) {
		editableEntryConfig.onBeforeUnload = [];
	}
	editableEntryConfig.onBeforeUnload.push(callback);
}

/**
 * Lifecycle summary (|| = semi-parallel execution, achieved with Promise.all):
 * - create the page component if not in cache
 * - before-unload previous component || before-load new component
 * - pause previous component if resumable || resume new component if in cache || animate-transition
 * - after-unload previous component || after-load new component
 * - destroy previous component if not resumable
 * @param callback function that will be called when the component has finished loading
 */
export function onAfterLoad(callback: () => any): void {
	if (!editableEntryConfig) {
		throw new Error(lifecycleErrorText);
	}
	if (!editableEntryConfig.onAfterLoad) {
		editableEntryConfig.onAfterLoad = [];
	}
	editableEntryConfig.onAfterLoad.push(callback);
}

/**
 * Attaches a callback to the after-unload lifecycle phase.
 * Lifecycle summary (|| = semi-parallel execution, achieved with Promise.all):
 * - create the page component if not in cache
 * - before-unload previous component || before-load new component
 * - pause previous component if resumable || resume new component if in cache || animate-transition
 * - after-unload previous component || after-load new component
 * - destroy previous component if not resumable
 * @param callback function that will be called when the component has finished unloading
 */
export function onAfterUnload(callback: () => any): void {
	if (!editableEntryConfig) {
		throw new Error(lifecycleErrorText);
	}
	if (!editableEntryConfig.onAfterUnload) {
		editableEntryConfig.onAfterUnload = [];
	}
	editableEntryConfig.onAfterUnload.push(callback);
}

/**
 * Attaches a callback to the before-load lifecycle phase.
 * Lifecycle summary (|| = semi-parallel execution, achieved with Promise.all):
 * - create the page component if not in cache
 * - before-unload previous component || before-load new component
 * - pause previous component if resumable || resume new component if in cache || animate-transition
 * - after-unload previous component || after-load new component
 * - destroy previous component if not resumable
 * @param callback function that will be called when the component is being prepared for loading
 */
export function onBeforeLoad(callback: () => any): void {
	if (!editableEntryConfig) {
		throw new Error(lifecycleErrorText);
	}
	if (!editableEntryConfig.onBeforeLoad) {
		editableEntryConfig.onBeforeLoad = [];
	}
	editableEntryConfig.onBeforeLoad.push(callback);
}

/**
 * Determines whether the component will be paused or destroyed
 * @param resumable whether the component should be paused and resumed or completely destroyed and recreated
 */
export function setResumable(resumable: boolean): void {
	if (!editableEntryConfig) {
		throw new Error(lifecycleErrorText);
	}
	editableEntryConfig.resumable = resumable;
}
