import { registerActions } from "./actions.js";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

let active = null;
let opener = null;

/**
 * Open dialog overlay
 * @param {HTMLElement} overlay - Overlay element
 * @return {void}
 */

export const openOverlay = (overlay) => {
	// Remember opener
	opener = document.activeElement;
	active = overlay;

	// Show and focus
	overlay.classList.add("open");
	document.body.style.overflow = "hidden";
	overlay.querySelector(FOCUSABLE)?.focus();
};

/**
 * Close dialog overlay
 * @param {HTMLElement|null} [overlay] - Defaults to active
 * @return {void}
 */

export const closeOverlay = (overlay = active) => {
	if (!overlay) return;

	// Hide overlay
	overlay.classList.remove("open");
	document.body.style.overflow = "";

	// Restore focus
	if (overlay !== active) return;
	opener?.focus?.();
	active = null;
};

/**
 * Trap Tab focus
 * @param {KeyboardEvent} event - Tab key event
 * @return {void}
 */

const trapFocus = (event) => {
	const items = [...active.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent);
	const edge = event.shiftKey ? items[0] : items.at(-1);
	if (document.activeElement !== edge) return;
	event.preventDefault();
	(event.shiftKey ? items.at(-1) : items[0]).focus();
};

registerActions({
	close: (_arg, el) => closeOverlay(el.closest("[data-overlay]")),
});

// Backdrop click
document.addEventListener("click", (event) => {
	if (event.target.hasAttribute?.("data-overlay")) closeOverlay(event.target);
});

// Escape and tab
document.addEventListener("keydown", (event) => {
	if (!active) return;
	if (event.key === "Escape") closeOverlay();
	else if (event.key === "Tab") trapFocus(event);
});
