import "../index.js";
import { appendInlineMarkdown, stripInlineMarkdown } from "./inline-markdown.js";

const slug = new URLSearchParams(location.search).get("slug") ?? location.pathname.split("/").filter(Boolean).at(-1);
const content = document.getElementById("publication-content");
const title = document.getElementById("publication-title");

const unavailable = (message) => {
	title.textContent = message;
	document.querySelector(".badge-published")?.remove();
	document.getElementById("publication-domain").textContent = "";
	document.getElementById("publication-intro").textContent = "";
	content.replaceChildren();
};

const paragraphBlock = (text) => {
	const fragment = document.createDocumentFragment();
	for (const paragraph of text
		.split(/\n\s*\n/)
		.map((value) => value.trim())
		.filter(Boolean)) {
		const element = document.createElement("p");
		appendInlineMarkdown(element, paragraph);
		fragment.append(element);
	}
	return fragment;
};

const imageFigure = (image, className) => {
	const figure = document.createElement("figure");
	figure.className = className;
	const element = document.createElement("img");
	const focusX = image.focusX ?? 50;
	const focusY = image.focusY ?? 50;
	element.src = image.src;
	element.alt = image.alt;
	element.loading = "lazy";
	element.style.objectPosition = `${focusX}% ${focusY}%`;
	element.style.transformOrigin = `${focusX}% ${focusY}%`;
	element.style.transform = `scale(${image.zoom ?? 1})`;
	const caption = document.createElement("figcaption");
	caption.textContent = image.caption ?? "";
	figure.append(element, caption);
	return figure;
};

const renderBox = (box) => {
	if (box.type === "stats") {
		const row = document.createElement("div");
		row.className = "stat-row article-stat-row";
		for (const item of box.items) {
			const card = document.createElement("div");
			card.className = "stat-box";
			const value = document.createElement("div");
			value.className = "num";
			appendInlineMarkdown(value, item.value);
			const label = document.createElement("div");
			label.className = "lbl";
			appendInlineMarkdown(label, item.label);
			card.append(value, label);
			row.append(card);
		}
		return row;
	}

	if (box.type === "image") {
		return imageFigure(box, `article-image-box image-position-${box.position ?? "above"}`);
	}

	if (box.type === "conclusion") {
		const wrapper = document.createElement("div");
		wrapper.className = "conclusion-box";
		wrapper.append(paragraphBlock(box.body));
		return wrapper;
	}

	if (box.type === "highlight") {
		const wrapper = document.createElement("div");
		wrapper.className = "geo-visual";
		const heading = document.createElement("h4");
		appendInlineMarkdown(heading, box.title);
		wrapper.append(heading, paragraphBlock(box.body));
		return wrapper;
	}

	const grid = document.createElement("div");
	grid.className = "def-grid article-definition-box";
	const card = document.createElement("div");
	card.className = "def-card";
	const heading = document.createElement("h5");
	heading.textContent = box.title;
	card.append(heading, paragraphBlock(box.body));
	grid.append(card);
	return grid;
};

if (!slug) unavailable("Cet article n’est pas disponible.");
else {
	try {
		const response = await fetch(`/api/studies?slug=${encodeURIComponent(slug)}`);
		if (response.status === 404) unavailable("Cet article n’est pas disponible.");
		else if (!response.ok) throw new Error(`Article request failed (${response.status})`);
		else {
			const article = await response.json();
			document.querySelector(".badge-published").hidden = false;
			title.replaceChildren();
			appendInlineMarkdown(title, article.title);
			if (article.heroImage?.src) {
				const heroLayout = document.getElementById("publication-hero-layout");
				const heroImageData = article.heroImage;
				heroLayout.classList.add("has-image", `image-position-${heroImageData.position ?? "right"}`);
				const heroImage = document.getElementById("publication-hero-image");
				const image = document.getElementById("publication-hero-image-src");
				image.src = heroImageData.src;
				image.alt = heroImageData.alt;
				image.style.objectPosition = `${heroImageData.focusX ?? 50}% ${heroImageData.focusY ?? 50}%`;
				image.style.transformOrigin = `${heroImageData.focusX ?? 50}% ${heroImageData.focusY ?? 50}%`;
				image.style.transform = `scale(${heroImageData.zoom ?? 1})`;
				heroImage.hidden = false;
			}
			document.getElementById("publication-domain").textContent = article.domain;
			const intro = document.getElementById("publication-intro");
			intro.replaceChildren();
			appendInlineMarkdown(intro, article.intro);
			document.title = `${stripInlineMarkdown(article.title)} | Pulse Santé`;
			const articleUrl = location.origin + location.pathname;
			document.querySelector('meta[name="description"]')?.setAttribute("content", stripInlineMarkdown(article.desc));
			document.querySelector('meta[property="og:title"]')?.setAttribute("content", `${stripInlineMarkdown(article.title)} | Pulse Santé`);
			document.querySelector('meta[property="og:description"]')?.setAttribute("content", stripInlineMarkdown(article.desc));
			document.querySelector('meta[property="og:url"]')?.setAttribute("content", articleUrl);
			document.querySelector('link[rel="canonical"]')?.setAttribute("href", articleUrl);
			const structuredData = {
				"@context": "https://schema.org",
				"@type": "Article",
				headline: stripInlineMarkdown(article.title),
				description: stripInlineMarkdown(article.desc),
				mainEntityOfPage: articleUrl,
				inLanguage: "fr",
				author: { "@type": "Organization", name: "Pulse Santé" },
			};
			const jsonLd = document.querySelector('script[type="application/ld+json"]');
			if (jsonLd) jsonLd.textContent = JSON.stringify(structuredData);
			for (const section of article.sections) {
				const sectionElement = document.createElement("section");
				sectionElement.className = "article-section";
				const label = document.createElement("div");
				label.className = "section-label";
				appendInlineMarkdown(label, section.label);
				const heading = document.createElement("h2");
				appendInlineMarkdown(heading, section.title);
				sectionElement.append(label, heading);
				if (section.image?.src) {
					const position = section.image.position ?? "above";
					const layout = document.createElement("div");
					layout.className = `article-section-content image-position-${position}`;
					const body = document.createElement("div");
					body.className = "article-section-copy";
					body.append(paragraphBlock(section.body));
					const figure = imageFigure(section.image, "article-section-image");
					if (position === "above" || position === "left") layout.append(figure, body);
					else layout.append(body, figure);
					sectionElement.append(layout);
				} else {
					sectionElement.append(paragraphBlock(section.body));
				}
				for (const box of section.boxes ?? []) sectionElement.append(renderBox(box));
				content.append(sectionElement);
			}

			const references = article.references.filter((reference) => reference.title || reference.url);
			if (references.length) {
				const list = document.createElement("section");
				list.className = "refs";
				const heading = document.createElement("h4");
				heading.textContent = "Références";
				const ordered = document.createElement("ol");
				for (const reference of references) {
					const item = document.createElement("li");
					appendInlineMarkdown(item, reference.title);
					if (reference.url) {
						const link = document.createElement("a");
						link.href = reference.url;
						link.textContent = new URL(reference.url).hostname;
						link.target = "_blank";
						link.rel = "noopener noreferrer";
						item.append(" ", link);
					}
					ordered.append(item);
				}
				list.append(heading, ordered);
				content.append(list);
			}
		}
	} catch (error) {
		unavailable("Impossible de charger cet article pour le moment.");
		console.error(error);
	}
}
