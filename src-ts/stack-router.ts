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
	timestamp: number,
	returnValue?: any,
}

export interface HistoryItem {
	location: string,
	state: HistoryState,
}

const config = {
	inhibitLocationStoreUpdate: false,
	inhibitHref: false,
	useHash: true,
	restoreScroll: true,
	routes: {} as Record<string, SvelteComponent>,
};

export interface StackEntry {
	scrollX: number,
	scrollY: number,
	component: SvelteComponent,
	pathname: string,
	params: object | undefined,
	routeMatch: string,
	onResume?: ((returnValue: any) => any)[],
	onPause?: (() => any)[],
	zIndex: number,
	resumable: boolean,
}

type TopStackEntry = Omit<StackEntry, 'zIndex' | 'scrollX' | 'scrollY'>;

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

function buildParams(pathname: string, routeKey: string): Record<string, string | null> | undefined {
	const { pattern, keys } = regexparam(routeKey);
	const matches = pattern.exec(pathname) || [];
	const params = keys.reduce((params, _, index) => {
		params[keys[index]] = matches[index + 1] === undefined ? null : decodeURIComponent(matches[index + 1]);
		return params;
	}, {} as Record<string, string | null>);
	return Object.keys(params).length === 0 ? undefined : params;
}

function getNewTop(stackEntries: StackEntry[], pathname: string): StackEntry | TopStackEntry | null {
	const routeKeys = Object.keys(config.routes);
	const routeKey = routeKeys.find((routeKey) => {
		const { pattern } = regexparam(routeKey);
		return pattern.test(pathname);
	});
	if (routeKey === undefined || routeKey === null) {
		return null;
	}
	const resumableEntryIndex = stackEntries.findIndex(
		(s) => s.routeMatch === routeKey,
	);
	if (resumableEntryIndex !== -1) {
		stackEntries[resumableEntryIndex].component = config.routes[routeKey]; // for backward navigation in case of Placeholders
		if (stackEntries[resumableEntryIndex].pathname !== pathname) {
			stackEntries[resumableEntryIndex].params = buildParams(pathname, routeKey);
			stackEntries[resumableEntryIndex].pathname = pathname;
		}
		return stackEntries[resumableEntryIndex];
	}
	return {
		component: config.routes[routeKey],
		params: buildParams(pathname, routeKey),
		pathname,
		routeMatch: routeKey,
		resumable: true,
	};
}

function stackTop(stackEntries: StackEntry[]): StackEntry | null {
	return stackEntries
		.reduce((top: StackEntry | null, curr) => (top === null || curr.zIndex > top.zIndex) ? curr : top, null);
}

function stackPush(stackEntries: StackEntry[], entry: TopStackEntry): StackEntry[] {
	stackEntries.push({
		...entry,
		zIndex: stackEntries.length,
		scrollX: 0,
		scrollY: 0,
	});
	return stackEntries;
}

let historyItems: HistoryItem[] = [];
async function handleHistoryChange(historyItem: HistoryItem): Promise<void> {
	config.inhibitHref = true;
	const currentStack: StackEntry[] = get(stack);

	// console.debug('history before');
	// console.debug(historyItems);
	// console.debug('stack before');
	// console.debug(currentStack);

	const newHistoryItem = !historyItem.state;
	if (newHistoryItem) {
		historyItem.state = {
			timestamp: new Date().getTime(),
		};
		await waitForHistoryState(() => window.history.replaceState(historyItem.state, '', (config.useHash ? '#' : '') + historyItem.location));
	}

	const newTop = getNewTop(currentStack, getPathname(historyItem.location));
	if (!newTop) {
		console.error('no route found');
	} else {
		const oldTop = stackTop(currentStack);
		const newTopAlreadyInStack = currentStack.some((s) => s.routeMatch === newTop.routeMatch);

		if (!oldTop) {
			historyItems = [historyItem];
			stackPush(currentStack, newTop);
		} else if (oldTop.routeMatch !== newTop.routeMatch) {
			if (!oldTop.resumable) {
				oldTop.scrollX = 0;
				oldTop.scrollY = 0;
				oldTop.onResume = undefined;
				oldTop.onPause = undefined;
				oldTop.component = Placeholder as unknown as SvelteComponent;
			} else if (oldTop.onPause && oldTop.onPause.length > 0) {
				oldTop.scrollX = window.scrollX;
				oldTop.scrollY = window.scrollY;
				for (const callback of oldTop.onPause) {
					await callback();
				}
			}
			if (newTopAlreadyInStack) {
				config.inhibitLocationStoreUpdate = true;

				const newTopStackEntry = newTop as StackEntry;
				if (newHistoryItem || historyItem.state.timestamp > lastHistoryTimestamp) { // FORWARD WITH NEW HISTORY ITEM OR WITH ARROW-RIGHT BROWSER KEY
					if (!newHistoryItem) {
						// console.debug('forward');
						historyItems.push(historyItem);
					} else { // FORWARD WITH NEW HISTORY ITEM
						// console.debug('push - existing');

						if (currentStack.length - 1 - newTopStackEntry.zIndex <= historyItems.length - 1) {
							// console.debug('BACK FROM ' + window.location.href); 
							await waitForHistoryState(() => window.history.back());
							// console.debug('TO ' + window.location.href);

							const backCount = currentStack.length - 1 - newTopStackEntry.zIndex;
							for (let i = 0; i < backCount; i++) {
								// console.debug('BACK FROM ' + window.location.href); 
								await waitForHistoryState(() => window.history.back());
								// console.debug('TO ' + window.location.href);
							}
							// console.debug('REPLACE FROM ' + window.location.href);
							await waitForHistoryState(() => window.history.replaceState(
								historyItems[historyItems.length - backCount].state,
								'',
								(config.useHash ? '#' : '') + historyItems[historyItems.length - backCount].location,
							));
							// console.debug('TO ' + window.location.href);
							for (let i = 0; i < backCount - 1; i++) {
								// console.debug('PUSH FROM ' + window.location.href);
								await waitForHistoryState(() => window.history.pushState(
									historyItems[historyItems.length - backCount + 1 + i].state,
									'',
									(config.useHash ? '#' : '') + historyItems[historyItems.length - backCount + 1 + i].location,
								));
								// console.debug('TO ' + window.location.href);
							}
							// console.debug('PUSH FROM ' + window.location.href);
							await waitForHistoryState(() => window.history.pushState(
								historyItem.state,
								'',
								(config.useHash ? '#' : '') + historyItem.location,
							));
							// console.debug('TO ' + window.location.href);

							historyItems.splice(historyItems.length - backCount - 1, 1);
							historyItems.push(historyItem);
						} else {
							historyItems.push(historyItem);
						}
					}
					currentStack.forEach((entry) => {
						if (entry.zIndex > newTopStackEntry.zIndex) {
							entry.zIndex--;
						}
					});
					newTopStackEntry.zIndex = currentStack.length - 1;
				} else if (historyItem.state.timestamp < lastHistoryTimestamp) { // BACK
					// console.debug('back');
					currentStack.forEach((entry) => {
						entry.zIndex++;
					});
					oldTop.zIndex = 0;

					historyItems.splice(historyItems.length - 1, 1);
				} else if (historyItem.state.timestamp === lastHistoryTimestamp) { // REPLACE
					// console.debug('replace - existing');
					if (currentStack.length - 1 - newTopStackEntry.zIndex <= historyItems.length - 1) {
						const backCount = currentStack.length - 1 - newTopStackEntry.zIndex;
						for (let i = 0; i < backCount; i++) {
							await waitForHistoryState(() => window.history.back());
						}
						await waitForHistoryState(() => window.history.replaceState(
							historyItems[historyItems.length - backCount].state,
							'',
							(config.useHash ? '#' : '') + historyItems[historyItems.length - backCount].location,
						));
						for (let i = 0; i < backCount - 1; i++) {
							await waitForHistoryState(() => window.history.pushState(
								historyItems[historyItems.length - backCount + 1 + i].state,
								'',
								(config.useHash ? '#' : '') + historyItems[historyItems.length - backCount + 1 + i].location,
							));
						}
						await waitForHistoryState(() => window.history.replaceState(
							historyItem.state,
							'',
							(config.useHash ? '#' : '') + historyItem.location,
						));

						historyItems.splice(historyItems.length - backCount - 1, 1);
						historyItems[historyItems.length - 1] = historyItem;
					} else {
						historyItems[historyItems.length - 1] = historyItem;
					}

					currentStack.forEach((entry) => {
						entry.zIndex++;
					});
					oldTop.zIndex = 0;

					currentStack.forEach((entry) => {
						if (entry.zIndex > newTopStackEntry.zIndex) {
							entry.zIndex--;
						}
					});
					newTopStackEntry.zIndex = currentStack.length - 1;
				}

				config.inhibitLocationStoreUpdate = false;
			} else {
				if (historyItem.state && historyItem.state.timestamp === lastHistoryTimestamp) {
					// console.debug('replace - new');
					currentStack.forEach((entry) => {
						entry.zIndex++;
					});
					oldTop.zIndex = 0;

					historyItems[historyItems.length - 1] = historyItem;
				} else {
					// console.debug('push - new');
					historyItems.push(historyItem);
				}
				stackPush(currentStack, newTop);
			}
		}

		lastHistoryTimestamp = historyItem.state.timestamp;
		
		stack.set(currentStack);
		
		await tick();

		if (newTopAlreadyInStack && newTop.resumable) {
			const { returnValue } = historyItem.state || {};
			if (newTop && newTop.onResume && newTop.onResume.length > 0) {
				for (const callback of newTop.onResume) {
					await callback(returnValue);
				}
			}
		}

		if (config.restoreScroll) {
			await animationFrame();

			window.scrollTo(currentStack[currentStack.length - 1].scrollX, currentStack[currentStack.length - 1].scrollY);
		}
	}
	// console.debug('history after');
	// console.debug(historyItems);
	// console.debug('stack after');
	// console.debug(currentStack);

	location.set(historyItem.location);
	config.inhibitHref = false;
}

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
				historyItemsQueue.push({
					location: $locationPreview,
					state: window.history.state,
				});
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
			},
			'',
			(config.useHash ? '#' : '') + location,
		);
	});

	dispatchCustomEvent(window as any, 'popstate');
}

export async function push(location: string): Promise<void> {
	if (config.restoreScroll) {
		await waitForHistoryState(() => {
			window.history.replaceState({
				timestamp: window.history.state ? window.history.state.timestamp : new Date().getTime(),
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

export async function pop(returnValue?: any): Promise<void> {
	config.inhibitLocationStoreUpdate = true;
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

export function setResumable(resumable: boolean): void {
	const stackEntries: StackEntry[] = get(stack);
	const stackEntry = stackTop(stackEntries);
	if (!stackEntry) {
		return;
	}
	stackEntry.resumable = resumable;
}