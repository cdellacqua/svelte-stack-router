import Home from './pages/Home.svelte';
import Resumable from './pages/Resumable.svelte';
import Throwaway from './pages/Throwaway.svelte';
import Redirect from './pages/Redirect.svelte';
import NotFound from './pages/NotFound.svelte';

export default {
	'/': Home,
	'/resumable/:aVariable?': Resumable,
	'/throwaway': Throwaway,
	'/redirect': Redirect,
	'*': NotFound,
};
