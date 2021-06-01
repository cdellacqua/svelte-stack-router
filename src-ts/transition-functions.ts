/* eslint-disable no-restricted-properties */
import { NavigationType, TransitionFunction, TransitionFunctionData } from './types';
import { animationFrame, sleep } from './utils';

function makeStyleTag(content: string): HTMLStyleElement {
	const styleTag = document.createElement('style');
	styleTag.innerHTML = content;
	return styleTag;
}

export function commonTransitionGenerator(
	duration: number,
	styleGenerators: (
		(loadClass: string, unloadClass: string, routerClass: string, transitionFunctionData: TransitionFunctionData) => HTMLStyleElement
	)[],
): TransitionFunction {
	return async (transitionFunctionData) => {
		const timestamp = new Date().getTime();
		const unloadClass = `unload-${timestamp}`;
		const loadClass = `load-${timestamp}`;
		const routerClass = `router-${timestamp}`;

		const {
			mountPointToUnload, mountPointToLoad, scroll, routerMountPoint,
		} = transitionFunctionData;

		mountPointToUnload?.classList.add(unloadClass);
		mountPointToLoad.classList.add(loadClass);
		routerMountPoint.classList.add(routerClass);

		const styleNodes = new Array<HTMLStyleElement>(styleGenerators.length);
		for (let i = 0; i < styleGenerators.length; i++) {
			const styleNode = styleGenerators[i](loadClass, unloadClass, routerClass, transitionFunctionData);
			styleNodes[i] = styleNode;
			document.head.appendChild(styleNode);
			await animationFrame();
			await animationFrame();
			await animationFrame();
		}

		await sleep(duration);

		window.scrollTo(scroll.x, scroll.y);
		if (window.getComputedStyle(document.documentElement).scrollBehavior === 'smooth') {
			// At the moment of writing this comment there is no official/simple way to wait for the
			// window.scrollTo method to complete the animation
			// Hack: loop for a maximum of 500ms checking if the scroll position is close enough to the target scroll
			const threshold = 5;
			for (let i = 0; i < 50; i++) {
				if (
					Math.sqrt(
						Math.pow(window.scrollX - scroll.x, 2)
						+ Math.pow(window.scrollY - scroll.y, 2),
					) < threshold
				) {
					break;
				}
				await sleep(10);
			}
		}

		for (const styleNode of styleNodes) {
			document.head.removeChild(styleNode);
		}

		mountPointToUnload?.classList.remove(unloadClass);
		mountPointToLoad.classList.remove(loadClass);
		routerMountPoint.classList.remove(routerClass);
	};
}

export function slide(duration: number): TransitionFunction {
	return commonTransitionGenerator(
		duration,
		[
			(loadClass, unloadClass, routerClass, {
				navigationType,
			}) => makeStyleTag(`
				html {
					scroll-behavior: smooth;
				}
				.${loadClass} {
					position: absolute;
					z-index: 2;
					left: 0;
					top: 0;
					right: 0;
					opacity: 0;
					transform: translateX(${navigationType === NavigationType.GoBackward ? '-' : ''}50%);
				}
				.${unloadClass} {
					position: relative;
					z-index: 1;
					opacity: 1;
					transform: translateX(0%);
				}
				.${routerClass} {
					position: relative;
					overflow: hidden;
				}
			`),
			(_1, _2, routerClass, {
				mountPointToLoad,
				mountPointToUnload,
			}) => makeStyleTag(`
				.${routerClass} {
					min-height: ${Math.max(mountPointToLoad.offsetHeight, mountPointToUnload?.offsetHeight || 0)}px;
					min-width: ${Math.max(mountPointToLoad.offsetWidth, mountPointToUnload?.offsetWidth || 0)}px;
				}
			`),
			(loadClass, unloadClass, _, { navigationType }) => makeStyleTag(`
				.${loadClass} {
					transition: transform ${duration}ms, opacity ${Math.floor(duration / 2)}ms linear ${Math.floor(duration / 2)}ms;
					opacity: 1;
					transform: translateX(0%);
				}
				.${unloadClass} {
					transition: transform ${duration}ms, opacity ${Math.floor(duration / 2)}ms linear;
					opacity: 0;
					transform: translateX(${navigationType === NavigationType.GoBackward ? '' : '-'}50%);
				}
			`),
		],
	);
}

export function dive(duration: number): TransitionFunction {
	return commonTransitionGenerator(
		duration,
		[
			(loadClass, unloadClass, routerClass, { navigationType }) => makeStyleTag(`
				html {
					scroll-behavior: smooth;
				}
				.${loadClass} {
					position: absolute;
					z-index: 2;
					left: 0;
					top: 0;
					right: 0;
					opacity: 0;
					transform: translateZ(${navigationType === NavigationType.GoBackward ? '' : '-'}150px);
				}
				.${unloadClass} {
					position: relative;
					z-index: 1;
					opacity: 1;
					transform: translateZ(0px);
				}
				.${routerClass} {
					perspective: 1200px;
					perspective-origin: top center;
					position: relative;
					overflow: hidden;
				}
			`),
			(_1, _2, routerClass, {
				mountPointToLoad,
				mountPointToUnload,
			}) => makeStyleTag(`
				.${routerClass} {
					min-height: ${Math.max(mountPointToLoad.offsetHeight, mountPointToUnload?.offsetHeight || 0)}px;
					min-width: ${Math.max(mountPointToLoad.offsetWidth, mountPointToUnload?.offsetWidth || 0)}px;
				}
			`),
			(loadClass, unloadClass, _, { navigationType }) => makeStyleTag(`
				.${loadClass} {
					transition: transform ${duration}ms, opacity ${Math.floor(duration / 2)}ms linear ${Math.floor(duration / 2)}ms;
					opacity: 1;
					transform: translateZ(0px);
				}
				.${unloadClass} {
					transition: transform ${duration}ms, opacity ${Math.floor(duration / 2)}ms linear;
					opacity: 0;
					transform: translateZ(${navigationType === NavigationType.GoBackward ? '-' : ''}150px);
				}
			`),
		],
	);
}

export function noAnimation(): TransitionFunction {
	return ({ scroll }) => {
		window.scrollTo(scroll.x, scroll.y);
		return Promise.resolve();
	};
}
