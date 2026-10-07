import { registerActions } from "../components/actions.js";

const LOGIN = "/admin/login/";
/**
 * Element by ID
 * @param {string} id - Element ID
 * @return {HTMLElement} - Matching element
 */

const $ = (id) => document.getElementById(id);

/**
 * API request
 * @param {string} path - Endpoint path
 * @param {object} [body] - JSON payload
 * @return {Promise<Response>} - Fetch response
 */

const request = (path, body) =>
	fetch(path, {
		method: body ? "POST" : "GET",
		headers: body ? { "Content-Type": "application/json" } : {},
		body: body ? JSON.stringify(body) : undefined,
		signal: AbortSignal.timeout(15000),
	});

/**
 * Pad two digits
 * @param {number} value - Number to pad
 * @return {string} - Padded text
 */

const pad = (value) => String(value).padStart(2, "0");

/**
 * Datetime input value
 * @param {string} iso - ISO date
 * @return {string} - Local value
 */

const toInputValue = (iso) => {
	const date = new Date(iso);
	return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

/**
 * Show toast
 * @param {string} message - Toast text
 * @return {void}
 */

const toast = (message) => {
	$("toast").textContent = message;
	$("toast").classList.add("show");
	setTimeout(() => $("toast").classList.remove("show"), 3000);
};

/**
 * Render status badge
 * @param {boolean} enabled - Maintenance on
 * @return {void}
 */

const renderStatus = (enabled) => {
	$("statusBadge").className = `status-badge status-${enabled ? "maintenance" : "online"}`;
	$("statusBadge").replaceChildren(
		Object.assign(document.createElement("span"), { className: "status-dot" }),
		enabled ? "Maintenance activée" : "Site opérationnel",
	);
	$("statusDetail").textContent = enabled ? "Les visiteurs voient la page de maintenance." : "Tous les visiteurs peuvent accéder au site normalement.";
	$("dashStatus").textContent = enabled ? "🟠" : "🟢";
};

let timer;

/**
 * Render countdown
 * @param {{ enabled: boolean, endTime: string|null }} state - Maintenance state
 * @return {void}
 */

const renderCountdown = ({ enabled, endTime }) => {
	clearInterval(timer);
	const tick = () => {
		const remaining = new Date(endTime) - Date.now();
		$("countdown-display").hidden = !enabled || !endTime || remaining <= 0;
		const total = Math.max(0, Math.floor(remaining / 1000));
		$("countdown-text").textContent = [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60].map(pad).join(":");
	};
	tick();
	if (enabled && endTime) timer = setInterval(tick, 1000);
};

/**
 * Render full state
 * @param {{ enabled: boolean, endTime: string|null }} state - Maintenance state
 * @return {void}
 */

const render = (state) => {
	$("maintenanceToggle").checked = state.enabled;
	$("maintenanceEnd").value = state.endTime ? toInputValue(state.endTime) : "";
	renderStatus(state.enabled);
	renderCountdown(state);
};

registerActions({
	section: (id, el) => {
		document.querySelectorAll(".section, .nav-item").forEach((node) => node.classList.remove("active"));
		$(id).classList.add("active");
		el.classList.add("active");
	},
	logout: async () => {
		await request("/api/logout", {});
		location.replace(LOGIN);
	},
});

/**
 * Save maintenance
 * @param {SubmitEvent} event - Submit event
 * @return {Promise<void>}
 */

const save = async (event) => {
	event.preventDefault();

	// Build state
	const end = $("maintenanceEnd").value;
	const state = {
		enabled: $("maintenanceToggle").checked,
		endTime: end ? new Date(end).toISOString() : null,
	};

	// Persist state
	const response = await request("/api/maintenance", state).catch(() => null);
	if (response?.status === 401) return location.replace(LOGIN);
	if (!response?.ok) return toast("Échec de la sauvegarde");
	render(state);
	toast("Paramètres sauvegardés");
};

$("maintenanceForm").addEventListener("submit", save);

$("maintenanceToggle").addEventListener("change", (event) => renderStatus(event.target.checked));

// Session gate
const session = await request("/api/session").catch(() => null);
if (session?.status === 401) location.replace(LOGIN);
else
	render(
		await request("/api/maintenance")
			.then((response) => response.json())
			.catch(() => ({ enabled: false, endTime: null })),
	);
