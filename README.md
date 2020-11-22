# svelte-stack-router

Bridging the gap between Native Apps and WebApps. A Stack-based Svelte Router that will make your WebApp feel more native

## Working demo
* [App.svelte](https://github.com/cdellacqua/svelte-stack-router/blob/master/src/App.svelte)

You can clone this repo and run `npm run dev` to see it working

## Quick setup

- import the init function and the StackRouter component
- call the init function passing the routes*
- done

*routes: they are defined as an object like the following:

```
{
	"/": Home,
	"/my-page": PageComponent,
	"/my-other-page/:someString": OtherPageThatAcceptsAParameter,
	"/my-other-page2/:optionalParam?": OtherPageThatAcceptsAnOptionalParameter,
	"*": "MatchAll"
}
```

## How it works

This library takes advantage of the ability of Svelte of mutating the DOM without re-rendering unchanged HTML.

When you navigate to a new page, the component associated with that URL gets instantiated - nothing special about this behaviour.

Things get interesting when you go back in your history or go to a page that had already been visited.

**Previously instantiated pages don't get destroyed by default, they just get paused and resumed to reduce re-renders and preserve their state**

What happens is that the browser history gets sorted to bring the previously visited page on top of the others.

For example:

Suppose you have 3 resumable pages (see [`setResumable`](#enhanced-lifecycle-functions) below), let's call them P1, P2, P3.
The user visits your pages in the following order P1 -> P2 -> P3.

Each time the user goes to a new page, the previous component gets "paused". Its HTML is not removed from the page, it just isn't displayed.

If the user goes to P2, the following happens:
- the StackRouter sees that P2 had already been created, so its HTML is still in the DOM
- P2 is raised to the top and displayed, while P3 is lowered; in other words, P2 is Resumed, while P3 is Paused
- the new stack is P1 -> P3 -> P2
- the browser history gets modified to reflect this new order

If the user presses the back button, then P2, which is the current top of the stack, gets destroyed.
The page order is not modified: P1 -> P3

## Enhanced lifecycle functions

In addition to the `onMount` and `onDestroy` lifecycle functions provided by Svelte, this library offers `onPause` and `onResume`.
- `onPause` handlers are called **before** a component is lowered
- `onResume` handlers are called **after** a component has been raised
- `onBeforeUnload` handlers are called **before** a component is **lowered or destroyed** and before any pause handlers,
so it can be used for either resumable and non-resumable components

All these new lifecycle functions accept synchronous and asynchronous callbacks. In case of asynchronous callbacks each one of them gets executed
in a synchronous manner.

`onResume` also supports a return value that can be passed using the `pop` function (see the [Returning values](#returning-values)).
Both these lifecycle functions can be called by the Page component and by its children.

If you have a component which shouldn't be paused or resumed by the StackRouter, you can call:
- `setResumable`

and pass `false`. Doing this will make you component disposable, so that it will be mounted and destroyed and never paused or resumed.

## Navigation functions

The following functions that enables programmatic navigation are provided:
- `push('/some-route')`
- `pop()` or `pop({ some: 'return value' })` (see [Returning values](#returning-values))
- `replace('/a-route')`

Those functions are inspired by the ones offered by [svelte-spa-router](https://github.com/ItalyPaleAle/svelte-spa-router)

## Returning values

When the `pop` function is called it can receive an optional parameter, which acts like a return value.

This value will be passed on as an argument to all the callback functions that are registered in the `onResume` hook of the component that is about to be resumed, thus allowing the two components to communicate with each other.

For example:
- suppose the user is on `/selection`, a page that presents them with a list of items and expects them to pick one. In the same page there is an `Add` button
- the user clicks on the `Add` button, thus navigating to `/new`, a page with a form where they can POST a new item to the list
- the user submits the form and, in the submit handler, `pop` is called with the `id` of the newly created entity
- the user gets brought back to `/selection`, which, being resumable, can handle the return value in its `onResume` callback(s) and show the selection on the newly created entity