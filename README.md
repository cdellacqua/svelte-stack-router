# svelte-stack-router

Bridging the gap between Native Apps and WebApps. A Stack-based Svelte Router that will make your WebApp feel more native

## Working demo
* [App.svelte](https://github.com/cdellacqua/svelte-stack-router/blob/master/src/App.svelte)

You can clone this repo, run `npm i` and `npm run dev` to try it out

## Quick setup

- open/create the component that will contain the StackRouter
- define your routes as key-value pairs, like in the following example
	```javascript
	let myRoutes = {
		"/": Home,
		"/my-page": PageComponent,
		"/my-other-page/:someString": OtherPageThatAcceptsAParameter,
		"/my-other-page2/:optionalParam?": OtherPageThatAcceptsAnOptionalParameter,
		"*": NotFound,
	};
	```
- import the StackRouter component
- add `<StackRouter routes={myRoutes} />` somewhere in the HTML section

Example:
```svelte
<script>
	import { StackRouter } from 'svelte-stack-router';
	import Home from './Home.svelte';
	import NotFound from './NotFound.svelte';

	let routes = {
		"/": Home,
		"*": NotFound
	};
</script>
<StackRouter {routes} />
```

## How it works

Page components are cached, this ensures that going back in the browser history resumes the complete previous state.

In other words: **previously instantiated pages don't get destroyed by default, they just get paused and resumed to reduce re-renders and preserve their full state**

## Enhanced lifecycle functions

In addition to the `onMount` and `onDestroy` lifecycle functions provided by Svelte, this library offers `onPause`, `onResume`, `onBeforeLoad`, `onBeforeUnload`, `onAfterLoad` and `onAfterUnload`.

All these new lifecycle functions accept synchronous and asynchronous callbacks. In case of asynchronous callbacks they are executed one by one in the same order they were registered.

The complete lifecycle is (|| = semi-parallel execution, achieved with Promise.all):
- create the page component if not in cache
- before-unload previous component || before-load new component
- pause previous component if resumable || resume new component if in cache || animate-transition
- after-unload previous component || after-load new component
- destroy previous component if not resumable

All these additional lifecycle functions can be called by the Page component and by its children **during initialization**, this means they should be invoked directly in the script section of the Svelte component (e.g. not inside onMount or in reactive statements).

If you have a component which shouldn't be paused or resumed by the StackRouter, you can call `setResumable(false)`

Doing this will make your component disposable, so that it will be mounted and destroyed and never paused or resumed.

## Router events

You can listen for the following events:
- `on:navigation-start` emitted before unloading the old page and before loading the new page
- `on:navigation-end` emitted after unloading the old page and after loading the new page
- `on:error` emitted when the current location doesn't match with any available route

Example:
```svelte
<StackRouter {routes} on:navigation-start={() => alert('navigation started')} />
```

## Navigation functions and links

The following functions enable programmatic navigation:
- `push('/some-route')`
- `pop()` or `pop({ some: 'return value' })` (see [Returning values](#returning-values))
- `replace('/a-route')`

This library also provides a custom `use:link` action that you can add to your `<a>` elements to create links. This action serves two purposes:
- if you are using the router in "hash mode" (e.g. in a purely client-side rendering context), it lets you write paths without having to manually add the `#` prefix to all the `href`. For example `<a href="/example-1" use:link>Example</a>` is automatically
converted to `<a href="#/example-1">Example</a>`. This is particularly helpful if you later decide to switch to "path mode" (see next point)
- if you are using the router in "path mode" (e.g. in a server-side rendering context), it prevents the default browser navigation behavior and, on user click, pushes the new location using the History API of the browser

These navigation functions have been heavily inspired by [svelte-spa-router](https://github.com/ItalyPaleAle/svelte-spa-router).

## Returning values

When the `pop` function is called it can receive an optional parameter, which acts like a return value.

This value will be passed on as an argument to all the callback functions that are registered in the `onResume` hook of the component that is about to be resumed, thus allowing two components to communicate with each other.

For example:
- suppose the user is on `/selection`, a page that presents them with a list of items and expects them to pick one. In the same page there is an `Add` button
- the user clicks on the `Add` button, thus navigating to `/new`, a page with a form where they can POST a new item to the list
- the user submits the form and, in the submit handler, `pop` is called with the `id` of the newly created entity
- the user gets brought back to `/selection`, which, being resumable, can handle the return value in its `onResume` callback(s) and show the selection on the newly created entity


## Customizing behavior

The `<StackRouter>` component supports a variety of options:

|name|type|description|default|
|-|-|-|-|
|defaultResumable|boolean|whether or not the default behavior should be to resume or recreate the components|true|
|useHash|boolean|whether or not to prefix routes with '#' to implement a server-agnostic client side routing (e.g. no need to redirect 404 to index)|true|
|restoreScroll|boolean|whether or not to restore the scroll position when navigating backwards|true|
|transitionFn|TransitionFunction|a function that handles the transition between two pages|dive(300)|
|routes|Record.<string, SvelteComponent>|a key-value object associating a route path (e.g. '/a/route/path/:variable1?) to a SvelteComponent|N/A - **required**|

### TransitionFunction and available transitions

This library provides 3 types of transitions between pages:
- `dive(milliseconds)` transition with a dive effect
- `slide(milliseconds)` transition with a slide effect
- `noAnimation()` transition without any animation


You can also implement a custom transition animation by implementing a transition function that reflect the following type definition:
```typescript
/**
 * A function that handles the transition between two pages
 * @param {NavigationType} data.navigationType describes the navigation that occurred (e.g. backward, replace, forward, ...)
 * @param {HTMLElement} data.mountPointToLoad the mount point of the page that is being loaded
 * @param {HTMLElement} data.mountPointToUnload the mount point of the page that is being unloaded
 * @param {HTMLElement} data.routerMountPoint the router mount point, when this function is called it contains both the mountPointToLoad and the mountPointToUnload
 * @param {{x: number, y: number}} data.scroll if scroll restoration is enabled and the current component is being resumed, this object contains the x and y coordinates needed to bring the window scrollbars back to where they were when the component was paused
 * @return {Promise} a promise that resolves once the transition has finished
 */
export type TransitionFunction = (data: TransitionFunctionData) => Promise<void>;
```

You can also generate a TransitionFunction using the helpers provided in transition-functions.js
