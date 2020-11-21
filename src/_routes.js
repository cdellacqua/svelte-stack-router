import Page1 from './pages/Page1.svelte';
import Page2 from './pages/Page2.svelte';
import Page3 from './pages/Page3.svelte';

export default {
	'/': Page1,
	'/2': Page2,
	'/3': Page3,
	'/4': Page1,
};