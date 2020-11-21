<script>
	import { onDestroy, onMount } from "svelte";
import Placeholder from "./Placeholder.svelte";

	import {
		stack,
		handleStackRouterComponentMount,
		handleStackRouterComponentDestroy,
	} from "./stack-router";

	onMount(handleStackRouterComponentMount);
	onDestroy(handleStackRouterComponentDestroy);
</script>

<style>
	.top {
		display: block;
	}
	.back {
		display: none;
	}
</style>

{#each $stack as { component, zIndex, params, routeMatch } (component, routeMatch)}
	<div
		class:top={zIndex === $stack.length - 1}
		class:back={zIndex !== $stack.length - 1}
		class:placeholder={component === Placeholder}>
		<svelte:component this={component} {params} />
	</div>
{/each}
