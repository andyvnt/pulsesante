import "../index.js";
import { appendInlineMarkdown } from "./inline-markdown.js";

const groups = document.querySelector(".works-groups");

const badgeFor = (status) => {
	const badge = document.createElement("div");
	badge.className = status === "published" ? "badge-done" : status === "planned" ? "badge-planned" : "badge-wip";
	const dot = document.createElement("span");
	dot.className = "dot";
	badge.append(dot, status === "published" ? "Publié" : status === "planned" ? "Prévu" : "En cours");
	return badge;
};

const renderStudy = (study, index) => {
	const linked = study.status === "published" && study.hasArticle;
	const card = document.createElement(linked ? "a" : "div");
	card.className = `travail-card${linked ? "" : " wip"}`;
	card.dataset.key = study.slug;
	if (linked) card.href = study.href;

	const number = document.createElement("div");
	number.className = "card-num";
	number.textContent = String(index + 1).padStart(2, "0");
	const body = document.createElement("div");
	body.className = "card-body";
	const meta = document.createElement("div");
	meta.className = "card-meta";
	meta.append(badgeFor(study.status));
	const domain = document.createElement("div");
	domain.className = "card-domain";
	domain.textContent = study.domain;
	meta.append(domain);
	const heading = document.createElement("h3");
	appendInlineMarkdown(heading, study.title);
	const description = document.createElement("p");
	appendInlineMarkdown(description, study.desc);
	body.append(meta, heading, description);
	card.append(number, body);

	if (linked) {
		const arrow = document.createElement("div");
		arrow.className = "card-arrow";
		arrow.setAttribute("aria-hidden", "true");
		arrow.textContent = "→";
		card.append(arrow);
	}
	return card;
};

try {
	const response = await fetch("/api/studies");
	if (!response.ok) throw new Error(`Studies request failed (${response.status})`);
	const studies = await response.json();
	const published = studies.filter(({ status }) => status === "published");
	const ongoing = studies.filter(({ status }) => status !== "published");
	const makeGroup = (title, items, offset) => {
		if (!items.length) return null;
		const section = document.createElement("section");
		section.className = "works-group";
		const heading = document.createElement("h2");
		heading.className = "works-group-title";
		heading.textContent = title;
		const grid = document.createElement("div");
		grid.className = "travaux-grid";
		grid.append(...items.map((study, index) => renderStudy(study, offset + index)));
		section.append(heading, grid);
		return section;
	};
	const sections = [makeGroup("Publications", published, 0), makeGroup("En cours et à venir", ongoing, published.length)].filter(Boolean);
	groups.replaceChildren(...sections);
} catch (error) {
	console.error(error);
}
