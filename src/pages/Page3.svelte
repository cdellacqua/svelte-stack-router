<script>
	import { onMount, onDestroy } from "svelte";
	import { onPause, onResume, pathname, pop, link } from "../stack-router";

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

<h1>Example Page 3</h1>
<h2>{$pathname}</h2>
<a use:link href="/">Go to Page1</a>
<a use:link href="/2">Go to Page2</a>
<a use:link href="/3">Go to Page3</a>
<a use:link href="/4">Go to Page1 - second route</a>
<a use:link href="/5">Go to 404</a>
<button on:click={() => pop('bye!')}>Go back passing a returnValue</button>
<br />
<div>Events:</div>
{@html status.join('<br />')}
