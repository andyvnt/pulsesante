const MESSAGES = {
	401: "Email ou mot de passe incorrect",
	429: "Trop de tentatives, réessayez dans 15 minutes",
	503: "Administration non configurée",
	default: "Connexion impossible, réessayez",
};

const form = document.getElementById("loginForm");
const error = document.getElementById("error-msg");
const button = document.getElementById("loginBtn");

/**
 * Submit credentials
 * @param {SubmitEvent} event - Submit event
 * @return {Promise<void>}
 */

const login = async (event) => {
	event.preventDefault();
	// Reset state
	error.textContent = "";
	button.disabled = true;

	// Credentials request
	try {
		const response = await fetch("/api/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				email: form.elements.email.value,
				password: form.elements.password.value,
			}),
			signal: AbortSignal.timeout(15000),
		});
		if (response.ok) return location.replace("/admin/");
		error.textContent = MESSAGES[response.status] ?? MESSAGES.default;
	} catch {
		error.textContent = MESSAGES.default;
	}
	button.disabled = false;
};

form.addEventListener("submit", login);
