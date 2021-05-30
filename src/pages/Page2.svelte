<script>
	import { onMount, onDestroy } from "svelte";
	import {
		onPause,
		onResume,
		pathname,
		onBeforeUnload,
		onAfterLoad,
		onAfterUnload,
		onBeforeLoad,
	} from "../stack-router";
	import Links from "../components/Links.svelte";

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
		console.log("destroyed"); // will not be executed
	});
	onBeforeUnload(() => {
		status = [...status, "before unload"];
	});
	onAfterLoad(() => {
		status = [...status, "after load"];
	});
	onAfterUnload(() => {
		status = [...status, "after unload"];
	});
	onBeforeLoad(() => {
		status = [...status, "before load"];
	});
</script>

<div style="text-align: center">
	<h2>Current path: {$pathname}</h2>
</div>
<div style="text-align: center">
	<h1>Example Page 2</h1>
</div>
<Links />
<br />
<div>Events:</div>
{@html status.join("<br />")}
