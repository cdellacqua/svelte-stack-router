<script>
	import { init as initRouter, stack } from "./stack-router";
	import StackRouter from "./StackRouter.svelte";
	import routes from "./_routes";

	$: console.log($stack.map((entry) => entry.zIndex + ' ' + entry.component.name));

	initRouter(routes);
</script>

<style>
	:global(body) {
		font-family: sans-serif;
	}
</style>

<StackRouter />
