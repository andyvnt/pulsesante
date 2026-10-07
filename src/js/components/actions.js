const registry = {};

/**
 * Register click actions
 * @param {Record<string, (arg: string, el: HTMLElement, event: Event) => void>} handlers - Handlers by name
 * @return {void}
 */

export const registerActions = (handlers) => {
	Object.assign(registry, handlers);
};

/**
 * Run matching action
 * @param {Event} event - Click or key event
 * @return {void}
 */

const run = (event) => {
	// Closest action element
	const el = event.target.closest?.("[data-action]");
	registry[el?.dataset.action]?.(el.dataset.arg, el, event);
};

document.addEventListener("click", run);

// Keyboard activation
document.addEventListener("keydown", (event) => {
	const activates = event.key === "Enter" || event.key === " ";
	if (!activates || !event.target.matches?.('[role="button"][data-action]')) return;
	event.preventDefault();
	run(event);
});
