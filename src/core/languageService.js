import { StorageKeys } from "../utils/constants.js";

const SUPPORTED = new Set(["fr", "en", "es"]);
const DEFAULT = "fr";

let strings = {};
let ready;

/**
 * Detect language
 * @return {string} - Supported code
 */

const detect = () => {
	const stored = localStorage.getItem(StorageKeys.LANGUAGE);
	const browser = navigator.language?.slice(0, 2).toLowerCase();
	return [stored, browser].find((lang) => SUPPORTED.has(lang)) ?? DEFAULT;
};

/**
 * Fetch language file
 * @param {string} lang - Language code
 * @return {Promise<object>} - String tree
 */

const load = (lang) => fetch(`/assets/i18n/${lang}.json`).then((response) => (response.ok ? response.json() : Promise.reject(new Error(lang))));

/**
 * Load active language
 * @return {Promise<void>} - Shared promise
 */

export const initLanguage = () =>
	(ready ??= (async () => {
		const lang = detect();
		strings = await load(lang).catch(() => load(DEFAULT));
		document.documentElement.lang = lang;
	})());

/**
 * Raw translation node
 * @param {string} key - Dotted path
 * @return {*} - Value or undefined
 */

export const tVal = (key) => key.split(".").reduce((node, part) => node?.[part], strings);

/**
 * Translated string
 * @param {string} key - Dotted path
 * @param {Record<string, string|number>} [vars] - Placeholders
 * @return {string} - Text or key
 */

export const t = (key, vars = {}) => {
	const value = tVal(key);
	return typeof value === "string" ? value.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? "") : key;
};
