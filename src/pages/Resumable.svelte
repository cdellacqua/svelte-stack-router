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

	let wait1s = false;

	/** @type {HTMLVideoElement} */
	let videoRef;
	let videoWasPlaying = true;

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
		if (videoWasPlaying) {
			events = [...events, "onAfterLoad, resuming video"];
			videoRef?.play();
		} else {
			events = [...events, "onAfterLoad"];
		}
	});
	onBeforeUnload(() => {
		if (wait1s) {
			events = [
				...events,
				"onBeforeUnload. I'll just wait 1s before letting the router unload me",
			];
			return new Promise((res) => setTimeout(res, 1000));
		} else {
			events = [...events, "onBeforeUnload"];
		}
	});
	onPause(() => {
		let message = "onPause";
		if (videoRef && !videoRef.paused) {
			message += ", pausing video";
			videoRef.pause();
			videoWasPlaying = true;
		} else {
			videoWasPlaying = false;
		}
		events = [...events, message];
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
			bind:checked={wait1s}
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
<div style="padding-top: 10px">
	<p>
		This component <strong>will</strong> get cached. As a result the following video
		will be paused and resumed every time you visit this page
	</p>
	<video bind:this={videoRef} src="bunny.mp4" autoplay muted controls />
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
