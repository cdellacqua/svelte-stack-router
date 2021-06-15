<script>
	import { createEventDispatcher, onDestroy, onMount } from "svelte";

	import {
		handleStackRouterComponentMount,
		handleStackRouterComponentDestroy,
		handleUpdateConfig,
	} from "./stack-router";
	import { dive } from "./transition-functions.js";

	/** @type {boolean} whether or not the default behavior should be to resume or recreate the components */
	export let defaultResumable = true;
	/** @type {boolean} whether or not to prefix routes with '#' to implement a server-agnostic client side routing (e.g. no need to redirect 404 to index) */
	export let useHash = true;
	/** @type {boolean} whether or not to restore the scroll position when navigating backwards */
	export let restoreScroll = true;
	/** @type {import('../dist/types').TransitionFunction} a function that handles the transition between two pages */
	export let transitionFn = dive(300);
	/** @type {Record.<string, import('svelte').SvelteComponent>} a key-value object associating a route path (e.g. '/a/route/path/:variable1?) to a SvelteComponent */
	export let routes;

	let dispatch = createEventDispatcher();
	let mountPoint;
	onMount(() => {
		handleStackRouterComponentMount({
			mountPoint,
			routes,
			defaultResumable,
			useHash,
			restoreScroll,
			transitionFn,
			dispatch,
		});
	});
	onDestroy(() => {
		handleStackRouterComponentDestroy();
	});

	$: defaultResumable,
		useHash,
		restoreScroll,
		transitionFn,
		routes,
		handleUpdateConfig({
			routes,
			defaultResumable,
			useHash,
			restoreScroll,
			transitionFn,
		});
</script>

<div class="stack-router-mount-point" bind:this={mountPoint} />
