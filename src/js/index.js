import "./components/actions.js";
import "./components/overlay.js";
import "./components/nav.js";
import "./components/cookie.js";
import "./components/chatbot.js";

// Maintenance gate
fetch("/api/maintenance")
	.then((response) => response.json())
	.then(({ enabled, endTime }) => {
		if (enabled && (!endTime || new Date(endTime) > new Date())) location.replace("/maintenance/");
	})
	.catch(() => {});
