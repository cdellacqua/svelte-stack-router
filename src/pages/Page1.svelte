<script>
	import { onMount, onDestroy } from "svelte";
	import {
		onBeforeUnload,
		onPause,
		onResume,
		pathname,
		setResumable,
		onAfterLoad,
		onAfterUnload,
		onBeforeLoad,
	} from "../.";
	import Links from "../components/Links.svelte";

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
		console.log("destroyed");
	});
	onBeforeUnload(() => {
		status = [...status, "before unload, i'll just wait 1s"];
		return new Promise((res) => setTimeout(res, 1000));
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
	setResumable(false);
</script>

<div style="text-align: center">
	<h2>Current path: {$pathname}</h2>
</div>
<div style="text-align: center">
	<h1>Example Page 1</h1>
</div>
<Links />
<br />
<div>Events:</div>
{@html status.join("<br />")}
