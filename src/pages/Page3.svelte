<script>
	import { onMount, onDestroy } from "svelte";
	import { onPause, onResume, pathname } from "../.";
	import Links from "../components/Links.svelte";

	export let params = {
		demo: null,
	};

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
	<h1>Example Page 3, demo param: {params.demo}</h1>
</div>
<Links />
<div>Events:</div>
{@html status.join("<br />")}
