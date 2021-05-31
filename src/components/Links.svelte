<script>
	import { pop, link } from "../stack-router";
</script>

<div style="text-align: center; margin-bottom: 20px;">
	<a use:link href="/">Home</a>
	<a use:link href="/resumable">Go to Resumable</a>
	<a use:link href="/resumable/here you go!">Go to Resumable with parameter</a>
	<a use:link href="/throwaway">Go to Throwaway</a>
	{#if window.history.length > 2}
		<button on:click={() => pop("bye!")}
			>Go back passing a returnValue</button
		>
	{/if}
</div>
