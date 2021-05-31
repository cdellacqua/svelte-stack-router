<script>
	import {
		StackRouter,
		slide,
		dive,
		noAnimation,
		pathname,
	} from "../.";
	import routes from "../_routes";
	import Links from "../components/Links.svelte";

	let transitions = [
		{ label: "dive", fn: dive(300) },
		{ label: "slide", fn: slide(300) },
		{ label: "none", fn: noAnimation() },
	];

	let transitionIndex = 0;
	let transition = transitions[transitionIndex];

	$: transitionIndex, (transition = transitions[transitionIndex]);
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
	<Links />
	<StackRouter
		{routes}
		transitionFn={transition.fn}
		on:navigation-end={console.log}
		on:navigation-start={console.log}
		on:error={console.error}
	/>
</div>
