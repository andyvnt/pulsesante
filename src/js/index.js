import "./components/actions.js";
import "./components/overlay.js";
import "./components/nav.js";
import "./components/cookie.js";
import "./components/chatbot.js";
import { appendInlineMarkdown } from "./pages/inline-markdown.js";

const homeStudies = document.querySelector(".etudes-grid");

if (homeStudies) {
	const renderHomeStudy = (study) => {
		const published = study.status === "published";
		const card = document.createElement("div");
		card.className = `etude-card${published ? "" : " en-cours"}`;

		const badge = document.createElement("div");
		badge.className = `etude-badge ${published ? "badge-done" : "badge-wip"}`;
		const dot = document.createElement("span");
		dot.className = "badge-dot";
		badge.append(dot, published ? "Publié" : study.status === "planned" ? "Prévu" : "En cours");

		const domain = document.createElement("div");
		domain.className = "etude-domain";
		domain.textContent = study.domain;
		const heading = document.createElement("h4");
		appendInlineMarkdown(heading, study.title);
		const description = document.createElement("p");
		appendInlineMarkdown(description, study.desc);
		card.append(badge, domain, heading, description);

		if (published && study.hasArticle) {
			const link = document.createElement("a");
			link.className = "etude-link";
			link.href = study.href;
			link.textContent = "Lire l'article →";
			card.append(link);
		}
		return card;
	};

	fetch("/api/studies", { cache: "no-store" })
		.then((response) => {
			if (!response.ok) throw new Error(`Studies request failed (${response.status})`);
			return response.json();
		})
		.then((studies) => homeStudies.replaceChildren(...studies.map(renderHomeStudy)))
		.catch((error) => console.error(error));
}

const maintenancePage = location.pathname === "/maintenance/";
let checkingMaintenance = false;

const checkMaintenance = async () => {
	if (checkingMaintenance) return;
	checkingMaintenance = true;
	try {
		const response = await fetch("/api/maintenance", { cache: "no-store" });
		if (!response.ok) throw new Error(`Maintenance request failed (${response.status})`);
		const { enabled, endTime } = await response.json();
		const active = enabled && (!endTime || new Date(endTime) > new Date());
		if (active && !maintenancePage) location.replace("/maintenance/");
		else if (!active && maintenancePage) location.replace("/");
	} catch (error) {
		console.error(error);
	} finally {
		checkingMaintenance = false;
	}
};

checkMaintenance();
setInterval(checkMaintenance, 3000);
document.addEventListener("visibilitychange", () => {
	if (document.visibilityState === "visible") checkMaintenance();
});

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
