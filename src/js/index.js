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

if (location.pathname === "/article-conflits-armes/") {
	fetch("/api/studies")
		.then((response) => {
			if (!response.ok) throw new Error(`Studies request failed (${response.status})`);
			return response.json();
		})
		.then((studies) => {
			const study = studies.find(({ slug }) => slug === "conflits");
			if (!study || study.status !== "published") return location.replace("/travaux/");
			if (study.href !== location.pathname) return location.replace(study.href);
			const heading = document.querySelector(".article-hero h1");
			const domain = document.querySelector(".article-domain");
			const intro = document.querySelector(".article-intro");
			if (heading) heading.textContent = study.title;
			if (domain) domain.textContent = study.domain;
			if (intro) intro.textContent = study.desc;
		})
		.catch((error) => console.error(error));
}
