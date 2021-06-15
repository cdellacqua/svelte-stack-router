<script>
	import { StackRouter, slide, dive, noAnimation, pathname, push } from "../.";
	import routes from "../_routes";
	import Links from "../components/Links.svelte";
	import youShallPass from "../stores/you-shall-pass";

	let transitions = [
		{ label: "dive", fn: dive(300) },
		{ label: "slide", fn: slide(300) },
		{ label: "none", fn: noAnimation() },
	];

	let transitionIndex = 0;
	let transition = transitions[transitionIndex];

	$: transitionIndex, (transition = transitions[transitionIndex]);

	function handleForbidden({ detail }) {
		alert(`Access forbidden to ${detail.location}`);
		push("/");
	}

	let unmount = false;
</script>

<div style="padding: 10px; overflow: hidden">
	<div style="text-align: center">
		<h2>Location pathname: {$pathname}</h2>
	</div>
	<div style="text-align: center">
		<label
			>Transition:
			<select bind:value={transitionIndex}>
				{#each transitions as { label }, i}
					<option value={i}>{label}</option>
				{/each}
			</select>
		</label>
	</div>
	<div style="text-align: center">
		<label
			>Enable guarded route:
			<input type="checkbox" bind:checked={$youShallPass} />
		</label>
	</div>
	<div style="text-align: center">
		<label
			>Unmount stack router:
			<input type="checkbox" bind:checked={unmount} />
		</label>
	</div>
	<Links />
	{#if !unmount}
		<StackRouter
			{routes}
			transitionFn={transition.fn}
			on:navigation-end={console.log}
			on:navigation-start={console.log}
			on:error={console.error}
			on:forbidden={handleForbidden}
		/>
	{:else}
		<div style="text-align: center">
			StackRouter unmounted, all cached components have been destroyed
		</div>
	{/if}
</div>
