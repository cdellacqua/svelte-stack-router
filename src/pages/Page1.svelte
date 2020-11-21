<script>
	import { onMount, onDestroy } from "svelte";
	import { onPause, onResume, pathname, setResumable } from "../stack-router";

	let status = [];
	onMount(() => {
		status = [...status, "mounted"];
	});
	onPause(() => {
		status = [...status, "paused"]; // will not be executed
	});
	onResume((retVal) => {
		status = [...status, "resumed" + (retVal ? `, received: "${retVal}"` : "")]; // will not be executed
	});
	onDestroy(() => {
		console.log('destroyed');
	});
	setResumable(false);
</script>

<h1>Example Page 1</h1>
<h2>{$pathname}</h2>
<div>Events:</div>
<a href="#/">Go to Page1</a>
<a href="#/2">Go to Page2</a>
<a href="#/3">Go to Page3</a>
<a href="#/4">Go to Page1 - second route</a>
<br />
{@html status.join('<br />')}
