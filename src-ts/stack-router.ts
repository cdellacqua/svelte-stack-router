import regexparam from 'regexparam';
import { SvelteComponent, tick } from 'svelte';
import {
	readable, derived, writable, get,
} from 'svelte/store';
import Placeholder from './Placeholder.svelte';

function noop() { }

function animationFrame() {
	return new Promise((res) => requestAnimationFrame(() => res(undefined)));
}

function sleep(ms: number) {
	return new Promise((res) => setTimeout(() => res(undefined), ms));
}

function dispatchCustomEvent(element: HTMLElement, eventName: string) {
	element.dispatchEvent(new CustomEvent(eventName, {
		bubbles: true,
		cancelable: true,
	}));
}

export interface HistoryState {
	scrollX: number,
	scrollY: number,
	timestamp: number,
	returnValue?: any,
}

const config = {
	inhibitLocationStoreUpdate: false,
	inhibitHref: false,
	useHash: true,
	restoreScroll: true,
	routes: {} as Record<string, SvelteComponent>,
};

export interface StackEntry {
	component: SvelteComponent,
	location: string,
	params: object | undefined,
	routeMatch: string,
	onResume?: ((returnValue: any) => any)[],
	onPause?: (() => any)[],
	zIndex: number,
}

export const stack = writable<StackEntry[]>([]);

/** LOCATION */
function getLocation(): string {
	if (config.useHash) {
		const hashIndex = window.location.href.indexOf('#/');
		const location = hashIndex > -1 ? window.location.href.substring(hashIndex + 1) : '/';
		return location;
	}
	const relativeUrl = (window.location.pathname || '/') + window.location.search;
	return relativeUrl;
}
let previousLocation = getLocation();
export const locationPreview = readable(previousLocation, (set) => {
	const handlePopState = () => {
		const newLocation = getLocation();
		if (!config.inhibitLocationStoreUpdate && previousLocation !== newLocation) {
			previousLocation = newLocation;
			set(newLocation);
		}
	};
	window.addEventListener('popstate', handlePopState);
	return function stop() {
		window.removeEventListener('popstate', handlePopState);
	};
});
export const location = writable(previousLocation);

/** PATHNAME */
function getPathname(location: string): string {
	const queryStringPosition = location.indexOf('?');
	if (queryStringPosition !== -1) {
		return location.substring(0, queryStringPosition);
	}
	return location;
}
export const pathname = derived(location, getPathname);

/** SEARCH */
function getSearch(location: string): string {
	const queryStringPosition = location.indexOf('?');
	if (queryStringPosition !== -1) {
		return location.substring(queryStringPosition);
	}
	return '';
}
export const search = derived(location, getSearch);

/** UTILS */
let lastHistoryTimestamp: number;
async function waitForHistoryState(callback: () => void): Promise<void> {
	const historyState = window.history.state;
	callback();
	let limit = 100;
	while (historyState === window.history.state && limit) {
		await sleep(1);
		limit--;
	}
	if (historyState === window.history.state) {
		console.warn('unable to detect history change');
	}
}

function buildParams(location: string, routeKey: string): Record<string, string | null> | undefined {
	const { pattern, keys } = regexparam(routeKey);
	const matches = pattern.exec(getPathname(location)) || [];
	const params = keys.reduce((params, _, index) => {
		params[keys[index]] = matches[index + 1] === undefined ? null : decodeURIComponent(matches[index + 1]);
		return params;
	}, {} as Record<string, string | null>);
	return Object.keys(params).length === 0 ? undefined : params;
}

async function setup(location: string): Promise<void> {
	lastHistoryTimestamp = (window.history.state ? window.history.state.timestamp : new Date().getTime()) - 1;
	config.inhibitLocationStoreUpdate = true;
	await waitForHistoryState(() => {
		window.history.replaceState(
			{
				timestamp: lastHistoryTimestamp + 1,
				scrollX: 0,
				scrollY: 0,
			},
			'',
			(config.useHash ? '#' : '') + location,
		);
	});
	config.inhibitLocationStoreUpdate = false;
}

function buildStackEntry(stackEntries: StackEntry[], location: string, pathname: string): StackEntry | null {
	const routeKeys = Object.keys(config.routes);
	const routeKey = routeKeys.find((routeKey) => {
		const { pattern } = regexparam(routeKey);
		return pattern.test(pathname);
	});
	if (routeKey === undefined || routeKey === null) {
		return null;
	}
	const resumableEntryIndex = stackEntries.findIndex(
		(s) => s.component === config.routes[routeKey],
	);
	if (resumableEntryIndex !== -1) {
		if (stackEntries[resumableEntryIndex].location !== location) {
			stackEntries[resumableEntryIndex].params = buildParams(location, routeKey);
			stackEntries[resumableEntryIndex].location = location;
		}
		return stackEntries[resumableEntryIndex];
	}
	return {
		component: config.routes[routeKey],
		params: buildParams(location, routeKey),
		location,
		routeMatch: routeKey,
		zIndex: resumableEntryIndex === -1 ? stackSize(stackEntries) : stackEntries[resumableEntryIndex].zIndex,
	};
}

function buildBlankStackEntry(): StackEntry {
	return {
		component: Placeholder as unknown as SvelteComponent,
		params: undefined,
		location: '',
		routeMatch: '',
		zIndex: -1,
	};
}

async function reorderHistory(location: string, resumableEntryZIndex: number, stackEntries: StackEntry[]): Promise<void> {
	const size = stackSize(stackEntries);
	const historyItems = new Array<{ state: HistoryState, location: string }>(size - resumableEntryZIndex - 1);
	config.inhibitLocationStoreUpdate = true;
	for (let i = 0; i < historyItems.length; i++) {
		await waitForHistoryState(() => window.history.back());
		historyItems[historyItems.length - 1 - i] = {
			state: window.history.state,
			location: getLocation(),
		};
	}
	await waitForHistoryState(() => window.history.back());
	await waitForHistoryState(() => window.history.replaceState(
		historyItems[0].state,
		'',
		(config.useHash ? '#' : '') + historyItems[0].location,
	));
	for (let i = 1; i < historyItems.length; i++) {
		await push(historyItems[i].location, historyItems[i].state);
	}
	await push(location);
	config.inhibitLocationStoreUpdate = false;
}

async function reorder(location: string, newStackTop: StackEntry, stackEntries: StackEntry[]): Promise<void> {
	await reorderHistory(location, newStackTop.zIndex, stackEntries);

	stackRemove(stackEntries, stackEntries.indexOf(newStackTop));
	newStackTop.zIndex = stackSize(stackEntries);
	stack.set(stackPush(stackEntries, newStackTop));
}

let scroll = null;

function stackTop(stackEntries: StackEntry[]): StackEntry | null {
	return stackEntries.reduce((top: StackEntry | null, curr) => (top === null || (curr.zIndex > top.zIndex) ? curr : top), null);
}

function stackTopData(stackEntries: StackEntry[]): { entry: StackEntry | null, index: number } {
	return stackEntries.reduce((top: { entry: StackEntry | null, index: number }, curr, index) => (top.entry === null || (curr.zIndex > top.entry.zIndex) ? {
		entry: curr,
		index,
	} : top), {
		entry: null,
		index: -1,
	});
}

function stackRemove(stackEntries: StackEntry[], index: number): StackEntry[] {
	stackEntries.forEach((entry) => {
		if (entry.zIndex !== -1 && entry.zIndex > stackEntries[index].zIndex) {
			entry.zIndex--;
		}
	});
	stackEntries[index] = buildBlankStackEntry();
	let cleanFromIndex = stackEntries.length;
	for (; cleanFromIndex > 0; cleanFromIndex--) {
		if (stackEntries[cleanFromIndex - 1].zIndex !== -1) {
			break;
		}
	}
	stackEntries.splice(cleanFromIndex, stackEntries.length - cleanFromIndex);
	return stackEntries;
}

function stackPop(stackEntries: StackEntry[]): StackEntry[] {
	stackRemove(stackEntries, stackTopData(stackEntries).index);

	return stackEntries;
}

function stackPush(stackEntries: StackEntry[], entry: StackEntry): StackEntry[] {
	const blankIndex = stackEntries.findIndex((e) => e.zIndex === -1);
	if (blankIndex === -1) {
		stackEntries.push(entry);
	} else {
		stackEntries[blankIndex] = entry;
	}
	return stackEntries;
}

export function stackSize(stackEntries: StackEntry[]): number {
	return stackEntries.reduce((validIndeces, curr) => (curr.zIndex !== -1 ? validIndeces + 1 : validIndeces), 0);
}

/** NAVIGATION */
async function forward(location: string, entry: StackEntry, stackEntries: StackEntry[]): Promise<void> {
	const size = stackSize(stackEntries);
	if (entry.zIndex === size) {
		stack.set(stackPush(stackEntries, entry));
	} else if (entry.zIndex !== size - 1) {
		await reorder(location, entry, stackEntries);
	}
}

async function backward(stackEntries: StackEntry[]): Promise<void> {
	const newStack = stackPop(stackEntries);
	stack.set(newStack);
}

async function stillward(location: string, stackEntry: StackEntry, stackEntries: StackEntry[]): Promise<void> {
	const oldStackTop = stackTop(stackEntries);
	if (!oldStackTop || oldStackTop.component !== stackEntry.component) {
		const oldStackSize = stackSize(stackEntries);
		if (oldStackSize > 0) {
			await backward(stackEntries);
		}
		stackEntry.zIndex = Math.min(stackSize(stackEntries), stackEntry.zIndex);
		await forward(location, stackEntry, stackEntries);
	} else {
		oldStackTop.location = stackEntry.location;
		oldStackTop.params = stackEntry.params;
		oldStackTop.routeMatch = stackEntry.routeMatch;
		oldStackTop.onPause = stackEntry.onPause;
		oldStackTop.onResume = stackEntry.onResume;
		oldStackTop.zIndex = stackEntry.zIndex;
		stack.set(stackEntries);
	}
}

let firstRun = true;
async function handleLocationChange(locationPreview: string): Promise<void> {
	config.inhibitHref = true;
	const currentStack: StackEntry[] = get(stack);

	if (firstRun || !window.history.state) {
		firstRun = false;
		await setup(locationPreview);
	}

	const stackEntry = buildStackEntry(currentStack, locationPreview, getPathname(locationPreview));
	if (!stackEntry) {
		console.error('no route found');
	} else {
		const oldTop = stackTop(currentStack);
		const newTop = stackEntry;
		const newTopIsResumed = currentStack.some((s) => s.component === newTop.component);

		if (oldTop && oldTop.component !== newTop.component) {
			if (oldTop.onPause && oldTop.onPause.length > 0) {
				for (const callback of oldTop.onPause) {
					await callback();
				}
			}
		}

		if (window.history.state.timestamp > lastHistoryTimestamp) {
			await forward(locationPreview, stackEntry, currentStack);
			scroll = {
				x: 0,
				y: 0,
			};
		} else if (window.history.state.timestamp < lastHistoryTimestamp) {
			if (currentStack.length === 0) {
				await forward(locationPreview, stackEntry, currentStack);
				scroll = {
					x: 0,
					y: 0,
				};
			} else if (currentStack.length === 1) {
				await backward(currentStack);
				stackEntry.zIndex = 0;
				await forward(locationPreview, stackEntry, currentStack);
				scroll = {
					x: 0,
					y: 0,
				};
			} else {
				await backward(currentStack);
				scroll = {
					x: window.history.state.scrollX,
					y: window.history.state.scrollY,
				};
			}
		} else {
			await stillward(locationPreview, stackEntry, currentStack);
			scroll = {
				x: 0,
				y: 0,
			};
		}

		lastHistoryTimestamp = window.history.state.timestamp;

		await tick();

		const { returnValue } = window.history.state;
		if (!oldTop || oldTop.component !== newTop.component) {
			if (newTopIsResumed) {
				if (newTop && newTop.onResume && newTop.onResume.length > 0) {
					for (const callback of newTop.onResume) {
						await callback(returnValue);
					}
				}
			}
		}
		window.history.replaceState({
			timestamp: window.history.state ? window.history.state.timestamp : new Date().getTime(),
			scrollX: window.scrollX,
			scrollY: window.scrollY,
		}, '', (config.useHash ? '#' : '') + locationPreview);

		if (config.restoreScroll && scroll) {
			await animationFrame();
			window.scrollTo(scroll.x, scroll.y);
			scroll = null;
		}
	}
	location.set(locationPreview);
	config.inhibitHref = false;
}

const locationQueue: string[] = [];
let consumingQueue = false;
async function consumeQueue(): Promise<void> {
	if (consumingQueue) {
		return;
	}
	consumingQueue = true;
	while (locationQueue.length > 0) {
		const locationPreview = locationQueue.shift()!;
		await handleLocationChange(locationPreview);
	}
	consumingQueue = false;
}

export function init(routes: Record<string, SvelteComponent>, restoreScroll = true, useHash = true): void {
	config.routes = routes;
	config.restoreScroll = restoreScroll;
	config.useHash = useHash;
}

let locationPreviewSubscription = noop;
export function handleStackRouterComponentMount(): void {
	locationPreview
		.subscribe(
			($locationPreview) => {
				locationQueue.push($locationPreview);
				consumeQueue();
			},
		);
}

export function handleStackRouterComponentDestroy(): void {
	locationPreviewSubscription();
	stack.set([]);
	locationPreviewSubscription = noop;
}

/** API FUNCTIONS */
export async function replace(location: string, state?: HistoryState): Promise<void> {
	await waitForHistoryState(() => {
		window.history.replaceState(
			state || {
				timestamp: lastHistoryTimestamp,
				scrollX: 0,
				scrollY: 0,
			},
			'',
			(config.useHash ? '#' : '') + location,
		);
	});

	dispatchCustomEvent(window as any, 'popstate');
}

export async function push(location: string, state?: HistoryState): Promise<void> {
	if (config.restoreScroll) {
		await waitForHistoryState(() => {
			window.history.replaceState({
				timestamp: window.history.state ? window.history.state.timestamp : new Date().getTime(),
				scrollX: window.scrollX,
				scrollY: window.scrollY,
			}, '', (config.useHash ? '#' : '') + getLocation());
		});
	}

	await waitForHistoryState(() => {
		window.history.pushState(
			state || {
				timestamp: new Date().getTime(),
				scrollX: 0,
				scrollY: 0,
			},
			'',
			(config.useHash ? '#' : '') + location,
		);
	});

	dispatchCustomEvent(window as any, 'popstate');
}

export async function pop(returnValue?: any): Promise<void> {
	config.inhibitLocationStoreUpdate = true;
	await waitForHistoryState(() => window.history.back());
	await waitForHistoryState(() => {
		window.history.replaceState(
			{
				...window.history.state,
				returnValue,
			},
			'',
			(config.useHash ? '#' : '') + getLocation(),
		);
	});
	config.inhibitLocationStoreUpdate = false;
	dispatchCustomEvent(window as any, 'popstate');
}

export function link(node: HTMLAnchorElement, href?: string): { update: Function } {
	if (!node || !node.tagName || node.tagName.toLowerCase() !== 'a') {
		throw new Error('not a <a> tag');
	}

	async function pushState(e: MouseEvent) {
		if (!e.ctrlKey) {
			e.preventDefault();
			// for an unknown reason, pushing the state block any on:click handler attached in a Svelte file
			// this sleep let the event propagate and schedule the push call after the bubbling has finished
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

/** COMPONENT LIFECYCLE */
export function onResume(callback: () => any): void {
	const stackEntries: StackEntry[] = get(stack);
	const stackEntry = stackTop(stackEntries);
	if (!stackEntry) {
		return;
	}
	if (!stackEntry.onResume) {
		stackEntry.onResume = [];
	}
	stackEntry.onResume.push(callback);
}

export function onPause(callback: () => any): void {
	const stackEntries: StackEntry[] = get(stack);
	const stackEntry = stackTop(stackEntries);
	if (!stackEntry) {
		return;
	}
	if (!stackEntry.onPause) {
		stackEntry.onPause = [];
	}
	stackEntry.onPause.push(callback);
}
