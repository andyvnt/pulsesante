import { registerActions } from "./actions.js";

const REVEALED = ".reveal, .reveal-left, .reveal-right, .stagger";

/**
 * Smooth scroll to section
 * @param {string} id - Section ID
 * @return {void}
 */

const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

/**
 * Toggle mobile menu
 * @return {void}
 */

const toggleMenu = () => {
	const open = document.getElementById("mobileMenu")?.classList.toggle("open");
	const burger = document.getElementById("burgerBtn");
	burger?.classList.toggle("open", open);
	burger?.setAttribute("aria-expanded", String(open));
	document.body.style.overflow = open ? "hidden" : "";
};

registerActions({
	scroll: (id, el, event) => {
		event.preventDefault();
		scrollTo(id);
	},
	top: (arg, el, event) => {
		event.preventDefault();
		window.scrollTo({ top: 0, behavior: "smooth" });
	},
	menu: toggleMenu,
	"mobile-scroll": (id, el, event) => {
		event.preventDefault();
		toggleMenu();
		setTimeout(() => scrollTo(id), 280);
	},
});

// Nav shadow
const nav = document.getElementById("mainNav");
if (nav) {
	const update = () => nav.classList.toggle("scrolled", window.scrollY > 40);
	window.addEventListener("scroll", update, { passive: true });
	update();
}

// Reveal on scroll
const observer = new IntersectionObserver(
	(entries) =>
		entries.forEach((entry) => {
			if (!entry.isIntersecting) return;
			entry.target.classList.add("visible");
			observer.unobserve(entry.target);
		}),
	{ threshold: 0.1 },
);
document.querySelectorAll(REVEALED).forEach((el) => observer.observe(el));
