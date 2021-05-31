<script>
	import { onMount, onDestroy } from "svelte";
	import { fly } from "svelte/transition";
	import {
		onBeforeUnload,
		onPause,
		onResume,
		onAfterLoad,
		onAfterUnload,
		onBeforeLoad,
	} from "../.";

	export let params = {
		aVariable: null,
	};

	let events = [];

	let wait1s = true;

	// Example of a resumable component lifecycle
	onMount(() => {
		events = [...events, "onMount"];
	});
	onBeforeLoad(() => {
		events = [...events, "onBeforeLoad"];
	});
	onResume((retVal) => {
		events = [
			...events,
			"onResume" + (retVal ? `, received: "${retVal}"` : ""),
		];
	});
	onAfterLoad(() => {
		events = [...events, "onAfterLoad"];
	});
	onBeforeUnload(() => {
		if (!wait1s) {
			events = [...events, "onBeforeUnload"];
			return;
		}
		events = [
			...events,
			"onBeforeUnload, i'll just wait 1s before letting the router unload me",
		];
		return new Promise((res) => setTimeout(res, 1000));
	});
	onPause(() => {
		events = [...events, "onPause"];
	});
	onAfterUnload(() => {
		events = [...events, "onAfterUnload"];
	});
	onDestroy(() => {
		// This won't get called
		events = [...events, "onDestroy"];
	});
	
	let firstRun = true;
	function onParamsChange() {
		if (firstRun) {
			firstRun = false;
			return;
		}
		events = [...events, "onParamsChange"];
	}

	$: params, onParamsChange();

	let pOffsetHeight;
</script>

<div style="text-align: center">
	<h1>I'm a resumable component</h1>
</div>
<div style="text-align: center; margin-bottom: 10px">
	<label
		style="background-color: black; padding: 10px; display: inline-block; border-radius: 100px"
	>
		<input
			type="checkbox"
			checked={wait1s}
			on:change={({ target }) => (wait1s = target.checked)}
		/>
		Return a promise when unloading
	</label>
</div>
<div
	style="transition: height 200ms ease; height: {params.aVariable
		? pOffsetHeight
		: 0}px"
>
	{#if params.aVariable}
		<p
			bind:offsetHeight={pOffsetHeight}
			transition:fly={{ y: -10, duration: 200 }}
			style="margin: 0; display: inline-block; padding: 10px; border-radius: 100px; background-color: black"
		>
			I have a param! "{params.aVariable}"
		</p>
	{/if}
</div>
<div style="padding-top: 10px">Events so far:</div>
<div>
	<ul style="display: inline-block">
		{#each events as event}
			<li>
				{event}
			</li>
		{/each}
	</ul>
</div>
