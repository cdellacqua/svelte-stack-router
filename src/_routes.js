import Page1 from './pages/Page1.svelte';
import Page2 from './pages/Page2.svelte';
import Page3 from './pages/Page3.svelte';
import Page4 from './pages/Page4.svelte';
import Redirect from './pages/Redirect.svelte';
import NotFound from './pages/NotFound.svelte';

export default {
	'/': Page1,
	'/2': Page2,
	'/3/:demo?': Page3,
	'/4': Page1,
	'/5': Page4,
	'/5/:something': Page4,
	'/redirect': Redirect,
	'*': NotFound,
};