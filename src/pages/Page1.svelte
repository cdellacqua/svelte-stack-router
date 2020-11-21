<script>
	import { onMount, onDestroy } from "svelte";
	import { onPause, onResume, setResumable } from "../stack-router";

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
<div>Events:</div>
<a href="#/">Go to Page1</a>
<a href="#/2">Go to Page2</a>
<a href="#/3">Go to Page3</a>
<br />
{@html status.join('<br />')}
