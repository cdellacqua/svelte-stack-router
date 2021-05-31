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
<div style="padding-top: 10px">
	<p>
		This component <strong>won't</strong> get cached. As a result the following video
		will restart every time you visit this page
	</p>
	<video src="bunny.mp4" autoplay muted controls />
</div>
<div style="padding-top: 10px">Events so far:</div>
<div>
	<ul style="display: inline-block; margin: 0; text-align: left">
		{#each events as event}
			<li>
				{event}
			</li>
		{/each}
	</ul>
</div>
