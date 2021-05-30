<script>
	import { onMount, onDestroy } from "svelte";
	import { onPause, onResume, pathname, link } from "../.";

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
</script>

<div style="text-align: center">
	<h2>Current path: {$pathname}</h2>
</div>
<div style="text-align: center">
	<h1>Not found</h1>
</div>
<a use:link href="/redirect">Redirect</a>
<br />
<div>Events:</div>
{@html status.join("<br />")}
