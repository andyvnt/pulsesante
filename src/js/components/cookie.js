import { initLanguage, t, tVal } from "../../core/languageService.js";
import { Icons } from "../../utils/icons.js";
import { StorageKeys } from "../../utils/constants.js";
import { registerActions } from "./actions.js";
import { closeOverlay, openOverlay } from "./overlay.js";

const VERSION = "1.0";
const EXPIRY_MS = 365 * 24 * 3600 * 1000;
const CATEGORIES = [
	{ key: "necessary", required: true, icon: Icons.lock },
	{ key: "analytics", required: false, icon: Icons.barChart },
	{ key: "functional", required: false, icon: Icons.sliders },
];

/**
 * Element by ID
 * @param {string} id - Element ID
 * @return {HTMLElement} - Matching element
 */

const $ = (id) => document.getElementById(id);

/**
 * Read stored consent
 * @return {object|null} - Valid consent
 */

const readConsent = () => {
	// Parse and validate
	try {
		const consent = JSON.parse(localStorage.getItem(StorageKeys.COOKIE_CONSENT));
		return consent?.version === VERSION && Date.now() - consent.timestamp < EXPIRY_MS ? consent : null;
	} catch {
		return null;
	}
};

/**
 * Category consent
 * @param {string} category - Category key
 * @return {boolean} - True if allowed
 */

export const hasConsent = (category) => category === "necessary" || readConsent()?.choices[category] === true;

/**
 * Toggle banner
 * @param {boolean} visible - Show banner
 * @return {void}
 */

const setBanner = (visible) => {
	$("cookie-banner").classList.toggle("visible", visible);
	$("cookie-manage-btn").classList.toggle("visible", !visible);
	document.dispatchEvent(new CustomEvent(visible ? "cookie-banner:show" : "cookie-banner:hide"));
};

/**
 * Persist choices
 * @param {Record<string, boolean>} choices - Consent by category
 * @return {void}
 */

const save = (choices) => {
	localStorage.setItem(StorageKeys.COOKIE_CONSENT, JSON.stringify({ version: VERSION, timestamp: Date.now(), choices }));
	setBanner(false);
	closeOverlay($("cookie-settings-overlay"));
};

/**
 * Accept or reject all
 * @param {boolean} accepted - Accept optional
 * @return {void}
 */

const decideAll = (accepted) => save(Object.fromEntries(CATEGORIES.map(({ key, required }) => [key, required || accepted])));

/**
 * Open settings dialog
 * @return {void}
 */

const openSettings = () => {
	// Sync toggles
	const choices = readConsent()?.choices ?? {};
	for (const { key, required } of CATEGORIES) if (!required) $(`cookie-toggle-${key}`).checked = choices[key] === true;
	openOverlay($("cookie-settings-overlay"));
};

/**
 * Category label
 * @param {string} key - Category key
 * @return {string} - Translated label
 */

const label = (key) => t(`cookie.categories.${key}.label`);

/**
 * Category row
 * @param {{ key: string, required: boolean, icon: string }} category - Category config
 * @return {string} - Row markup
 */

const categoryRow = ({ key, required, icon }) => {
	const examples = tVal(`cookie.categories.${key}.examples`) ?? [];
	return `
		<div class="cookie-category">
			<div class="cookie-category-top">
				<div class="cookie-category-info">
					<span class="cookie-category-icon" aria-hidden="true">${icon}</span>
					<span class="cookie-category-label">${label(key)}${required ? `<span class="cookie-category-required">${t("cookie.required")}</span>` : ""}</span>
				</div>
				<label class="cookie-toggle" aria-label="${label(key)}">
					<input type="checkbox" id="cookie-toggle-${key}"${required ? " checked disabled" : ""}>
					<span class="cookie-toggle-slider"></span>
				</label>
			</div>
			<p class="cookie-category-desc">${t(`cookie.categories.${key}.description`)}</p>
			${examples.length ? `<p class="cookie-category-examples">${t("cookie.examples")}${examples.join(", ")}</p>` : ""}
		</div>`;
};

/**
 * Banner button
 * @param {string} action - Action name
 * @param {string} style - Style modifier
 * @param {string} text - Label key
 * @return {string} - Button markup
 */

const button = (action, style, text) => `<button class="cookie-btn cookie-btn--${style}" data-action="${action}">${t(text)}</button>`;

/**
 * Build consent UI
 * @return {void}
 */

const buildUI = () => {
	// Banner chips
	const chips = CATEGORIES.map(
		({ key, required, icon }) => `<span class="cookie-banner__cat${required ? " cookie-banner__cat--required" : ""}">${icon} ${label(key)}</span>`,
	);

	// Banner and dialog
	const root = document.createElement("div");
	root.innerHTML = `
		<div id="cookie-banner" class="cookie-banner" role="region" aria-label="${t("cookie.bannerLabel")}">
			<div class="cookie-banner__inner">
				<div class="cookie-banner__text">
					<div class="cookie-banner__icon" aria-hidden="true">${Icons.cookie}</div>
					<div>
						<strong class="cookie-banner__title">${t("cookie.bannerTitle")}</strong>
						<p class="cookie-banner__desc">${t("cookie.bannerDesc")} <a href="/confidentialite/">${t("cookie.learnMore")}</a></p>
						<div class="cookie-banner__cats">${chips.join("")}</div>
					</div>
				</div>
				<div class="cookie-banner__actions">
					${button("cookie-reject", "outline", "cookie.rejectAll")}
					${button("cookie-settings", "ghost", "cookie.customize")}
					${button("cookie-accept", "primary", "cookie.acceptAll")}
				</div>
			</div>
		</div>
		<div id="cookie-settings-overlay" class="cookie-settings-overlay" data-overlay role="dialog" aria-modal="true" aria-label="${t("cookie.settingsLabel")}">
			<div class="cookie-settings-panel">
				<div class="cookie-settings-header">
					<div class="cookie-settings-header-text">
						<h3>${t("cookie.settingsTitle")}</h3>
						<span class="cookie-settings-header-sub">${t("cookie.settingsSub")}</span>
					</div>
					<button class="cookie-settings-close" data-action="close" aria-label="${t("cookie.closeLabel")}">${Icons.close}</button>
				</div>
				<div class="cookie-settings-body">${CATEGORIES.map(categoryRow).join("")}</div>
				<div class="cookie-settings-footer">
					${button("cookie-reject", "ghost", "cookie.rejectAll")}
					<div class="cookie-settings-footer__right">
						${button("cookie-save", "outline", "cookie.save")}
						${button("cookie-accept", "primary", "cookie.acceptAll")}
					</div>
				</div>
			</div>
		</div>
		<button id="cookie-manage-btn" class="cookie-manage-btn" data-action="cookie-settings" aria-label="${t("cookie.manageLabel")}"><span class="cookie-manage-btn__icon">${Icons.cookie}</span> ${t("cookie.manageBtn")}</button>`;
	document.body.append(root);
};

registerActions({
	"cookie-accept": () => decideAll(true),
	"cookie-reject": () => decideAll(false),
	"cookie-settings": openSettings,
	"cookie-save": () => save(Object.fromEntries(CATEGORIES.map(({ key, required }) => [key, required || $(`cookie-toggle-${key}`).checked]))),
});

initLanguage().then(() => {
	buildUI();

	// First visit banner
	if (readConsent()) $("cookie-manage-btn").classList.add("visible");
	else setTimeout(() => setBanner(true), 600);
});
