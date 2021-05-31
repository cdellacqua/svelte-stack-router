<script>
	import { onMount, onDestroy } from "svelte";
	import {
		onBeforeUnload,
		onPause,
		onResume,
		onAfterLoad,
		onAfterUnload,
		onBeforeLoad,
		setResumable,
	} from "../.";

	let events = [];

	setResumable(false);

	// Example of a non-resumable component lifecycle
	onMount(() => {
		events = [...events, "onMount"];
	});
	onBeforeLoad(() => {
		events = [...events, "onBeforeLoad"];
	});
	onResume((retVal) => {
		// This won't get called
		events = [
			...events,
			"onResume" + (retVal ? `, received: "${retVal}"` : ""),
		]; // will not be executed
	});
	onAfterLoad(() => {
		events = [...events, "onAfterLoad"];
	});
	onBeforeUnload(() => {
		events = [...events, "onBeforeUnload"];
	});
	onPause(() => {
		// This won't get called
		events = [...events, "onPause"];
	});
	onAfterUnload(() => {
		events = [...events, "onAfterUnload"];
	});
	onDestroy(() => {
		events = [...events, "onDestroy"];
	});
</script>

<div style="text-align: center">
	<h1>I'm a non-resumable component</h1>
</div>
<div>Events so far:</div>
<div>
	<ul>
		{#each events as event}
			<li>
				{event}
			</li>
		{/each}
	</ul>
</div>
