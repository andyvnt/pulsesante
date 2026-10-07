const HOME = "/";

/**
 * Pad two digits
 * @param {number} value - Number to pad
 * @return {string} - Padded text
 */

const pad = (value) => String(value).padStart(2, "0");

/**
 * Show remaining time
 * @param {number} ms - Remaining milliseconds
 * @return {void}
 */

const show = (ms) => {
	const total = Math.floor(ms / 1000);
	const parts = {
		hours: Math.floor(total / 3600),
		minutes: Math.floor((total % 3600) / 60),
		seconds: total % 60,
	};
	for (const [id, value] of Object.entries(parts)) document.getElementById(id).textContent = pad(value);
};

// Current state
const state = await fetch("/api/maintenance")
	.then((response) => response.json())
	.catch(() => ({ enabled: false }));

if (!state.enabled) location.replace(HOME);
else if (state.endTime) {
	// Countdown loop
	const end = new Date(state.endTime).getTime();

	/**
	 * Update countdown
	 * @return {void}
	 */

	const tick = () => {
		const remaining = end - Date.now();
		if (remaining <= 0) return location.replace(HOME);
		show(remaining);
	};
	tick();
	setInterval(tick, 1000);
}
