import { SvelteComponent } from 'svelte';

export type SvelteComponentWithConstructor = SvelteComponent & {
	new(options: { target: HTMLElement, props: Record<string, any> }): SvelteComponent,
};

export interface HistoryState {
	timestamp: number,
	returnValue?: any,
	scroll?: {
		x: number,
		y: number,
	}
}

export interface HistoryItem {
	location: string,
	state: HistoryState,
}

export enum LoadableEntryAction {
	NoOp,
	New,
	Resume,
}

export enum UnloadableEntryAction {
	NoOp,
	Destroy,
	Pause,
}

export enum NavigationType {
	GoForwardNewState,
	GoForwardResumeState,
	GoBackward,
	Replace,
}

export interface TransitionFunctionData {
	navigationType: NavigationType,
	routerMountPoint: HTMLElement,
	mountPointToLoad: HTMLElement,
	mountPointToUnload: HTMLElement | null,
	scroll: {
		x: number,
		y: number,
	},
}

/**
 * A function that handles the transition between two pages
 * @param {NavigationType} data.navigationType describes the navigation that occurred (e.g. backward, replace, forward, ...)
 * @param {HTMLElement} data.mountPointToLoad the mount point of the page that is being loaded
 * @param {HTMLElement} data.mountPointToUnload the mount point of the page that is being unloaded
 * @param {HTMLElement} data.routerMountPoint the router mount point, when this function is called it contains both the mountPointToLoad and the mountPointToUnload
 * @param {{x: number, y: number}|undefined} data.scroll if scroll restoration is enabled and the current component is being resumed, this object contains the x and y coordinates needed to bring the window scrollbars back to where they were when the component was paused
 * @return {Promise} a promise that resolves once the transition has finished
 */
export type TransitionFunction = (data: TransitionFunctionData) => Promise<void>;

export type Routes = Record<string, SvelteComponentWithConstructor>;

export interface Config {
	/** Whether or not the default behavior should be to resume or recreate the components */
	defaultResumable: boolean,
	/** Whether or not to prefix routes with '#' to implement a server-agnostic client side routing (e.g. no need to redirect 404 to index) */
	useHash: boolean,
	/** Whether or not to restore the scroll position when navigating backwards */
	restoreScroll: boolean,
	/** A key-value object associating a route path (e.g. '/a/route/path/:variable1?) to a SvelteComponent */
	routes: Routes,
	/** Reference to the HTML element that will wrap all the page components */
	mountPoint: null | HTMLElement,
	/** A function that handles the transition between two pages */
	transitionFn: TransitionFunction,
	/** The Svelte dispatcher of the current instance of the StackRouter */
	dispatch: ((eventName: string, eventData?: Record<any, any>) => void) | null,
}

export type Params = Record<string, string | null>;

export type Guard = (params?: Params) => boolean | Promise<boolean>;

export interface ComponentConfig {
	onResume?: ((returnValue: any) => any)[],
	onPause?: (() => any)[],
	onBeforeUnload?: (() => any)[],
	onAfterLoad?: (() => any)[],
	onBeforeLoad?: (() => any)[],
	onAfterUnload?: (() => any)[],
	resumable: boolean,
}

export interface CacheEntry {
	component: SvelteComponentWithConstructor,
	componentInstance: SvelteComponent,
	pathname: string,
	routeMatch: string,
	entryConfig: ComponentConfig,
	mountPoint: HTMLDivElement,
}
