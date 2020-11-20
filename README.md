# svelte-stack-router

Svelte Router based on a Stack that will make your WebApp feel more native

## Working demo:
* [App.svelte](https://github.com/cdellacqua/svelte-stack-router/blob/master/src/App.svelte)

You can clone this repo and run `npm run dev` to see it working

## Quick setup

- import the init function and the StackRouter component
- call the init function passing the routes*
- done

*routes: they are defined as an object like the following:

{
	"/": Home,
	"/my-page": PageComponent,
	"/my-other-page/:someString": OtherPageThatAcceptsAParameter,
	"/my-other-page2/:optionalParam?": OtherPageThatAcceptsAnOptionalParameter,
	"*": "MatchAll"
}

## How does it work

This library takes advantage of the ability of Svelte of mutating the DOM without re-rendering unchanged HTML.

When you navigate to a new page, the component associated with that URL gets instantiated - nothing special about this behaviour.

Things get interesting when you go back in your history or go to a page that had already been visited.

**Previously instantiated pages don't get destroyed on forward navigation, only on backward navigation.**

What happens is that the browser history gets sorted to bring the previously visited page on top of the others.

In other words:

Suppose you have 3 pages, lets call them P1, P2, P3.
The user visits your pages in the following order P1 -> P2 -> P3.

Each time the user goes to a new page, the previous component gets "paused". Its HTML is not removed from the page, its just not displayed.

If the user goes to P2, the following happens:
- the StackRouter sees that P2 had previously been created, so its HTML is still in the DOM
- P2 is raised to the top and displayed, while P3 is lowered. P2 is Resumed, while P3 is Paused
- the new stack is P1 -> P3 -> P2
- the browser history gets modified to reflect this new order

If the user presses the back button, P2, which is the current top of the stack, is destroyed.
The page order is not modified: P1 -> P3

## Enhanced lifecycle functions

In addition to the onMount and onDestroy lifecycle functions provided by Svelte, this library offers onPause and onResume.
onPause is called **before** a component is lowered
onResume is called **after** a component has been raised

onResume also supports a return value that can be passed using the "pop" function

## Navigation functions

The following functions that enables programmatic navigation are provided:
- `push('/some-route')`
- `pop()` or `pop({ some: 'return value' })`
- `replace('/a-route')`

Those functions are inspired by the ones offered by [svelte-spa-router](https://github.com/ItalyPaleAle/svelte-spa-router)
