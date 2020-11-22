<script>
	import { onMount, onDestroy } from "svelte";
	import { onBeforeUnload, onPause, onResume, pathname, setResumable, onAfterLoad } from "../stack-router";

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
	onBeforeUnload(() => {
		status = [...status, "before unload, i'll just wait 1s"];
		return new Promise((res) => setTimeout(res, 1000));
	});
	onAfterLoad(() => {
		status = [...status, "after load"];
	});
	setResumable(false);
</script>

<h1>Example Page 1</h1>
<h2>{$pathname}</h2>
<a href="#/">Go to Page1</a>
<a href="#/2">Go to Page2</a>
<a href="#/3">Go to Page3</a>
<a href="#/4">Go to Page1 - second route</a>
<a href="#/5">Go to 404</a>
<br />
<div>Events:</div>
{@html status.join('<br />')}
