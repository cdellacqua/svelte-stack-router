<script>
	import { StackRouter, location, cache, slide, dive, noAnimation } from "../.";
	import routes from "../_routes";

	$: console.log($cache.map((entry) => entry.component.name));

	// Randomize the transition to show that it can be changed at runtime
	let transitionFns = [dive(300), slide(300), noAnimation()];

	let transitionFn = transitionFns[0];

	let count = 0;
	$: $location, count++;
	$: if (count > 4) {
		count = 0;
		transitionFn =
			transitionFns[Math.floor(Math.random() * transitionFns.length)];
	}
</script>

<div style="padding: 10px; overflow: hidden">
	<StackRouter {routes} {transitionFn} />
</div>
