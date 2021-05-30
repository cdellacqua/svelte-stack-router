export function noop() { }

export function animationFrame() {
	return new Promise<void>((res) => requestAnimationFrame(() => res()));
}

export function sleep(ms: number) {
	return new Promise<void>((res) => setTimeout(() => res(), ms));
}

export function dispatchCustomEvent(element: HTMLElement, eventName: string) {
	element.dispatchEvent(new CustomEvent(eventName, {
		bubbles: true,
		cancelable: true,
	}));
}
