import { get } from 'svelte/store';
import Home from './pages/Home.svelte';
import Resumable from './pages/Resumable.svelte';
import Throwaway from './pages/Throwaway.svelte';
import Redirect from './pages/Redirect.svelte';
import NotFound from './pages/NotFound.svelte';
import Guarded from './pages/Guarded.svelte';
import AsyncComponent from './pages/AsyncComponent.svelte';
import youShallPass from './stores/you-shall-pass';

export default {
	'/': Home,
	'/resumable/:aVariable?': Resumable,
	'/throwaway': Throwaway,
	'/guarded': {
		component: Guarded,
		guard: () => get(youShallPass),
	},
	'/async': {
		componentProvider: () => new Promise(
			(resolve, reject) => setTimeout(
				// Simulate lazy loading
				() => resolve(AsyncComponent),

				// Simulate a network error
				// The promise can fail. In that case the router will emit an appropriate "error" event
				// with the details and the original error returned by the failed promise
				// () => reject(new Error('oh no!')),
				1000,
			),
		),
	},
	'/redirect': Redirect,
	'*': NotFound,
};
