import { RULES } from "../utils/validate.js";
import { allowAttempt } from "../utils/rateLimit.js";

/**
 * EmailJS settings injected at build
 * @type {{ publicKey: string, serviceId: string, templateId: string }}
 */

// eslint-disable-next-line no-undef
const emailjs = __EMAILJS__;

const ENDPOINT = "https://api.emailjs.com/api/v1.0/email/send";
const TIMEOUT_MS = 15000;

const MESSAGES = {
	prenom: "Prénom invalide",
	nom: "Nom invalide",
	email: "Adresse email invalide",
	telephone: "Numéro de téléphone invalide",
	organisation: "Organisation trop longue",
	besoin: "Sélectionnez un besoin",
	message: "Message trop long",
	limit: "Trop de tentatives, réessayez dans 5 minutes",
	failure: "Envoi impossible, réessayez ou écrivez-nous directement",
};

const form = document.getElementById("contactForm");
const status = document.getElementById("formStatus");
const button = form?.querySelector("button[type=submit]");

/**
 * Show form error
 * @param {string} message - Error text
 * @param {string} [field] - Invalid field name
 * @return {void}
 */

const fail = (message, field) => {
	status.textContent = message;
	if (field) form.elements[field].setAttribute("aria-invalid", "true");
};

/**
 * Send via EmailJS
 * @param {Record<string, string>} fields - Form values
 * @return {Promise<void>} - Resolves when sent
 */

const send = async (fields) => {
	const response = await fetch(ENDPOINT, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			service_id: emailjs.serviceId,
			template_id: emailjs.templateId,
			user_id: emailjs.publicKey,
			template_params: { ...fields, timestamp: new Date().toISOString() },
		}),
		signal: AbortSignal.timeout(TIMEOUT_MS),
	});
	if (!response.ok) throw new Error(`EmailJS ${response.status}`);
};

/**
 * Handle form submit
 * @param {SubmitEvent} event - Submit event
 * @return {Promise<void>}
 */

const submit = async (event) => {
	event.preventDefault();

	// Reset state
	status.textContent = "";
	form.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));

	// Bots fill the trap
	if (form.elements.website.value) return;

	// Field validation
	const fields = Object.fromEntries(Object.keys(RULES).map((name) => [name, form.elements[name].value.trim()]));
	const invalid = Object.keys(RULES).find((name) => !RULES[name](fields[name]));
	if (invalid) return fail(MESSAGES[invalid], invalid);
	if (!allowAttempt()) return fail(MESSAGES.limit);

	// Send request
	button.disabled = true;
	try {
		await send(fields);
		form.hidden = true;
		document.getElementById("formConfirm").style.display = "block";
		form.reset();
	} catch {
		fail(MESSAGES.failure);
		button.disabled = false;
	}
};

form?.addEventListener("submit", submit);
