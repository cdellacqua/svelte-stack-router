<script>
	import { pop, link, location } from "../.";
	import asyncComponentLoaded from "../stores/async-component-loaded";

	let historyLength = window.history.length;
	$: $location, (historyLength = window.history.length);
</script>

<div style="text-align: center; margin-bottom: 20px;">
	<a use:link href="/">Home</a>
	<a use:link href="/resumable">Go to Resumable</a>
	<a use:link href="/resumable/here you go!">Go to Resumable with parameter</a>
	<a use:link href="/throwaway">Go to Throwaway</a>
	<a use:link href="/unregistered-route">Go to 404</a>
	<a use:link href="/guarded">Go to Guarded</a>
	<a use:link href="/async">
		Go to Async
		{#if $asyncComponentLoaded}
			(will be instantaneous)
		{:else}
			(will take 1s)
		{/if}
	</a>
	{#if historyLength > 2}
		<button on:click={() => pop("bye!")}>Go back passing a returnValue</button>
	{/if}
</div>
