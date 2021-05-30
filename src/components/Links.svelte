<script>
	import { pop, link } from "../stack-router";

	let scrollY;
	$: scrollY, console.log(scrollY);

</script>

<div style="text-align: center; margin-bottom: 20px;">
	<a use:link href="/">Go to Page1</a>
	<a use:link href="/2">Go to Page2</a>
	<a use:link href="/3">Go to Page3</a>
	<a use:link href="/3/hello">Go to Page3 with a param</a>
	<a use:link href="/4">Go to Page1 - second route</a>
	<a use:link href="/5">Go to Page4 without a param</a>
	<a use:link href="/5/hello-too">Go to Page4 with a param</a>
	<a use:link href="/6">Go to 404</a>
	{#if window.history.length > 2}
		<button on:click={() => pop("bye!")}
			>Go back passing a returnValue</button
		>
	{/if}
</div>
