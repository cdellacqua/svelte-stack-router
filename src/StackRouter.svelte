<script>
	import { onDestroy, onMount } from "svelte";

	import {
		stack,
		handleStackRouterComponentMount,
		handleStackRouterComponentDestroy,
		stackSize,
	} from "./stack-router";

	$: size = stackSize($stack);

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

{#each $stack as { component, zIndex, params } (component)}
	<div
		class:top={zIndex !== -1 && zIndex === size - 1}
		class:back={zIndex !== -1 && zIndex !== size - 1}
		class:placeholder={zIndex === -1}>
		<svelte:component this={component} {params} />
	</div>
{/each}
