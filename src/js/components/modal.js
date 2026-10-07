import { sectors } from "../../config/data/sectors.json";
import { services } from "../../config/data/services.json";
import { registerActions } from "./actions.js";
import { closeOverlay, openOverlay } from "./overlay.js";

/**
 * Index by key
 * @param {Array<{ key: string }>} list - Keyed items
 * @return {Record<string, object>} - Items by key
 */

const byKey = (list) => Object.fromEntries(list.map((item) => [item.key, item]));

const SERVICES = byKey(services);
const SECTORS = byKey(sectors);

/**
 * Set element text
 * @param {string} id - Element ID
 * @param {string} value - New text
 * @return {void}
 */

const setText = (id, value) => {
	document.getElementById(id).textContent = value;
};

/**
 * Risk chips
 * @param {string[]} risks - Risk labels
 * @return {HTMLElement[]} - Chip elements
 */

const riskChips = (risks) =>
	risks.map((risk) =>
		Object.assign(document.createElement("span"), {
			className: "sector-risk-chip",
			textContent: risk,
		}),
	);

registerActions({
	"open-service": (key) => {
		// Fill service modal
		const { icon, title, body1, body2 } = SERVICES[key];
		document.getElementById("modal-icon").innerHTML = icon;
		setText("modal-title", title);
		setText("modal-body1", body1);
		setText("modal-body2", body2);
		openOverlay(document.getElementById("modal-overlay"));
	},
	"open-sector": (key) => {
		// Fill sector modal
		const { icon, title, subtitle, risks } = SECTORS[key];
		document.getElementById("sector-modal-icon").innerHTML = icon;
		setText("sector-modal-title", title);
		setText("sector-modal-subtitle", subtitle);
		document.getElementById("sector-risks-list").replaceChildren(...riskChips(risks));
		openOverlay(document.getElementById("sector-modal-overlay"));
	},
	"close-scroll": (id, el, event) => {
		// Close then scroll
		event.preventDefault();
		closeOverlay(el.closest("[data-overlay]"));
		setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 100);
	},
});
