<script>
	import { init as initRouter } from "./stack-router";
	import StackRouter from "./StackRouter.svelte";
	import routes from "./_routes";

	initRouter(routes);
</script>

<style>
	:global(body) {
		font-family: sans-serif;
	}
</style>

<StackRouter />
