<script>
	import { init } from './stack-router';
	import StackRouter from './StackRouter.svelte';
	import routes from './_routes';

	init(routes);
</script>

<style>
	:global(body) {
		font-family: sans-serif;
	}
</style>


<StackRouter />
