const NAME = /^\p{L}[\p{L}\p{M}' .-]{1,49}$/u;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[\d\s().-]{7,20}$/;

/**
 * Empty check
 * @param {string} value - Field value
 * @return {boolean} - True if empty
 */

const isEmpty = (value) => value === "";

/**
 * Contact form rules
 * @type {Record<string, (value: string) => boolean>}
 */

export const RULES = {
	prenom: (value) => NAME.test(value),
	nom: (value) => NAME.test(value),
	email: (value) => value.length <= 254 && EMAIL.test(value),
	telephone: (value) => isEmpty(value) || PHONE.test(value),
	organisation: (value) => value.length <= 100,
	besoin: (value) => !isEmpty(value),
	message: (value) => value.length <= 2000,
};
