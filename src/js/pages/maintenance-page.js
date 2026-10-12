const HOME = "/";

/**
 * Pad two digits
 * @param {number} value - Number to pad
 * @return {string} - Padded text
 */

const pad = (value) => String(value).padStart(2, "0");
let maintenanceEnd = null;

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

let checkingMaintenance = false;

const checkMaintenance = async () => {
	if (checkingMaintenance) return;
	checkingMaintenance = true;
	try {
		const response = await fetch("/api/maintenance", { cache: "no-store" });
		if (!response.ok) throw new Error(`Maintenance request failed (${response.status})`);
		const { enabled, endTime } = await response.json();
		if (!enabled) return location.replace(HOME);

		maintenanceEnd = endTime ? new Date(endTime).getTime() : null;
		if (maintenanceEnd !== null && maintenanceEnd <= Date.now()) return location.replace(HOME);
		document.querySelector(".countdown-panel").hidden = maintenanceEnd === null;
		tickCountdown();
	} catch (error) {
		console.error(error);
	} finally {
		checkingMaintenance = false;
	}
};

const tickCountdown = () => {
	if (maintenanceEnd === null) return;
	const remaining = maintenanceEnd - Date.now();
	if (remaining <= 0) return location.replace(HOME);
	show(remaining);
};

checkMaintenance();
setInterval(checkMaintenance, 3000);
document.addEventListener("visibilitychange", () => {
	if (document.visibilityState === "visible") checkMaintenance();
});
setInterval(tickCountdown, 1000);
