<script>
	import { setResumable } from "../.";
	import asyncComponentLoaded from "../stores/async-component-loaded";

	$asyncComponentLoaded = true;

	setResumable(false);
</script>

<div style="text-align: center">
	<h1>I'm an asynchronously loaded component</h1>
</div>
<div>
	I'll take some time to get loaded the first time, but if you come back I'll be
	ready, even if I'm not resumable!
</div>
