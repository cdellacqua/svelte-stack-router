/* eslint-disable import/named */
import type {
	NavigationType, TransitionFunction, CacheEntry, PageToUnloadAction, PageToLoadAction, Routes,
} from './types';

export * from './stack-router';
export * from './transition-functions';
export * from './types';
export * from './utils';
export class SvelteComponent {
	$$prop_def: {};

	$$slot_def: {};

	$on(event: string, handler: (e: CustomEvent) => any): () => void;
}
export class StackRouter extends SvelteComponent {
	$$prop_def: {
		/** Whether or not the default behavior should be to resume or recreate the components */
		defaultResumable: boolean,
		/** Whether or not to prefix routes with '#' to implement a server-agnostic client side routing (e.g. no need to redirect 404 to index) */
		useHash: boolean,
		/** Whether or not to restore the scroll position when navigating backwards */
		restoreScroll: boolean,
		/** A key-value object associating a route path (e.g. '/a/route/path/:variable1?) to a SvelteComponent constructor */
		routes: Routes,
		/** A function that handles the transition between two pages */
		transitionFn: TransitionFunction,
	}

	/** Triggered on errors such as "no route found" */
	$on(event: 'error', handler: (e: CustomEvent<{
		message: string,
		location: string,
	}>) => any): () => void;

	/** Triggered before unloading the old page and before loading the new page */
	$on(event: 'navigation-start', handler: (e: CustomEvent<{
		location: string,
		navigationType: NavigationType,
		pageToLoad: CacheEntry,
		pageToUnload: CacheEntry | null,
		pageToLoadAction: PageToLoadAction,
		pageToUnloadAction: PageToUnloadAction,
	}>) => any): () => void;

	/** Triggered after unloading the old page and after loading the new page */
	$on(event: 'navigation-end', handler: (e: CustomEvent<{
		location: string,
		navigationType: NavigationType,
		pageToLoad: CacheEntry,
		pageToUnload: CacheEntry | null,
		pageToLoadAction: PageToLoadAction,
		pageToUnloadAction: PageToUnloadAction,
	}>) => any): () => void;
}
