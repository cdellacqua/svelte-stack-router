<script>
	import { onMount, onDestroy } from "svelte";
	import { onPause, onResume, pathname, pop } from "../stack-router";

	let status = [];
	onMount(() => {
		status = [...status, "mounted"];
	});
	onPause(() => {
		status = [...status, "paused"];
	});
	onResume((retVal) => {
		status = [...status, "resumed" + (retVal ? `, received: "${retVal}"` : "")];
	});
	onDestroy(() => {
		console.log('destroyed'); // will not be executed
	});
</script>

<h1>Not found</h1>
<h2>{$pathname}</h2>
<a href="#/redirect">Redirect</a>
<br />
<div>Events:</div>
{@html status.join('<br />')}
