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
	styleBeforeGenerator: (loadClass: string, unloadClass: string, routerClass: string, transitionFunctionData: TransitionFunctionData) => HTMLStyleElement,
	styleDuringGenerator: (loadClass: string, unloadClass: string, routerClass: string, transitionFunctionData: TransitionFunctionData) => HTMLStyleElement,
): TransitionFunction {
	return async (transitionFunctionData) => {
		const timestamp = new Date().getTime();
		const unloadClass = `unload-${timestamp}`;
		const loadClass = `load-${timestamp}`;
		const routerClass = `router-${timestamp}`;
		const styleBefore = styleBeforeGenerator(loadClass, unloadClass, routerClass, transitionFunctionData);
		const styleDuring = styleDuringGenerator(loadClass, unloadClass, routerClass, transitionFunctionData);

		transitionFunctionData.mountPointToUnload?.classList.add(unloadClass);
		transitionFunctionData.mountPointToLoad.classList.add(loadClass);
		transitionFunctionData.routerMountPoint.classList.add(routerClass);

		document.head.appendChild(styleBefore);
		await animationFrame();
		await animationFrame();
		await animationFrame();
		document.head.appendChild(styleDuring);

		await sleep(duration);

		window.scrollTo(transitionFunctionData.scroll.x, transitionFunctionData.scroll.y);
		if (window.getComputedStyle(document.documentElement).scrollBehavior === 'smooth') {
			// At the moment of writing this comment there is no official/simple way to wait for the
			// window.scrollTo method to complete the animation
			// Hack: loop for a maximum of 500ms checking if the scroll position is close enough to the target transitionFunctionData.scroll
			const threshold = 5;
			for (let i = 0; i < 50; i++) {
				if (
					Math.sqrt(
						Math.pow(window.scrollX - transitionFunctionData.scroll.x, 2)
						+ Math.pow(window.scrollY - transitionFunctionData.scroll.y, 2),
					) < threshold
				) {
					break;
				}
				await sleep(10);
			}
		}

		document.head.removeChild(styleBefore);
		document.head.removeChild(styleDuring);

		transitionFunctionData.mountPointToUnload?.classList.remove(unloadClass);
		transitionFunctionData.mountPointToLoad.classList.remove(loadClass);
		transitionFunctionData.routerMountPoint.classList.remove(routerClass);
	};
}

export function slide(duration: number): TransitionFunction {
	return commonTransitionGenerator(
		duration,
		(loadClass, unloadClass, routerClass, transitionFunctionData) => makeStyleTag(`
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
				transform: translateX(${transitionFunctionData.navigationType === NavigationType.GoBackward ? '-' : ''}50%);
			}
			.${unloadClass} {
				position: relative;
				z-index: 1;
				opacity: 1;
				transform: translateX(0%);
			}
			.${routerClass} {
				position: relative;
				min-height: ${transitionFunctionData.routerMountPoint.offsetHeight}px;
				min-width: ${transitionFunctionData.routerMountPoint.offsetWidth}px;
			}
		`),
		(loadClass, unloadClass, _, transitionFunctionData) => makeStyleTag(`
			.${loadClass} {
				transition: transform ${duration}ms, opacity ${Math.floor(duration / 2)}ms linear ${Math.floor(duration / 2)}ms;
				opacity: 1;
				transform: translateX(0%);
			}
			.${unloadClass} {
				transition: transform ${duration}ms, opacity ${Math.floor(duration / 2)}ms linear;
				opacity: 0;
				transform: translateX(${transitionFunctionData.navigationType === NavigationType.GoBackward ? '' : '-'}50%);
			}
		`),
	);
}

export function dive(duration: number): TransitionFunction {
	return commonTransitionGenerator(
		duration,
		(loadClass, unloadClass, routerClass, transitionFunctionData) => makeStyleTag(`
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
				transform: translateZ(${transitionFunctionData.navigationType === NavigationType.GoBackward ? '' : '-'}150px);
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
				min-height: ${transitionFunctionData.routerMountPoint.offsetHeight}px;
				min-width: ${transitionFunctionData.routerMountPoint.offsetWidth}px;
				background: 
			}
		`),
		(loadClass, unloadClass, _, transitionFunctionData) => makeStyleTag(`
			.${loadClass} {
				transition: transform ${duration}ms, opacity ${Math.floor(duration / 2)}ms linear ${Math.floor(duration / 2)}ms;
				opacity: 1;
				transform: translateZ(0px);
			}
			.${unloadClass} {
				transition: transform ${duration}ms, opacity ${Math.floor(duration / 2)}ms linear;
				opacity: 0;
				transform: translateZ(${transitionFunctionData.navigationType === NavigationType.GoBackward ? '-' : ''}150px);
			}
		`),
	);
}

export function noAnimation(): TransitionFunction {
	return ({ scroll }) => {
		window.scrollTo(scroll.x, scroll.y);
		return Promise.resolve();
	};
}
