import { registerActions } from "../components/actions.js";
import { appendInlineMarkdown, stripInlineMarkdown } from "../pages/inline-markdown.js";

const LOGIN = "/admin/login/";
const RESERVED_SLUGS = new Set(["conflits", "risques-soignants", "leptospirose"]);
/**
 * Element by ID
 * @param {string} id - Element ID
 * @return {HTMLElement} - Matching element
 */

const $ = (id) => document.getElementById(id);

/**
 * API request
 * @param {string} path - Endpoint path
 * @param {object} [body] - JSON payload
 * @return {Promise<Response>} - Fetch response
 */

const request = (path, body) =>
	fetch(path, {
		method: body ? "POST" : "GET",
		headers: body ? { "Content-Type": "application/json" } : {},
		body: body ? JSON.stringify(body) : undefined,
		signal: AbortSignal.timeout(15000),
	});

/**
 * Pad two digits
 * @param {number} value - Number to pad
 * @return {string} - Padded text
 */

const pad = (value) => String(value).padStart(2, "0");

/**
 * Datetime input value
 * @param {string} iso - ISO date
 * @return {string} - Local value
 */

const toInputValue = (iso) => {
	const date = new Date(iso);
	return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

/**
 * Show toast
 * @param {string} message - Toast text
 * @return {void}
 */

const toast = (message) => {
	$("toast").textContent = message;
	$("toast").classList.add("show");
	setTimeout(() => $("toast").classList.remove("show"), 3000);
};

const imageUploads = new Set();

const updateImageCrop = (source, preview, frame, position, zoom) => {
	const focusX = Number(source.dataset.imageFocusX ?? 50);
	const focusY = Number(source.dataset.imageFocusY ?? 50);
	frame.dataset.orientation = ["left", "right"].includes(position.value) ? "vertical" : "horizontal";
	preview.style.objectPosition = `${focusX}% ${focusY}%`;
	preview.style.transformOrigin = `${focusX}% ${focusY}%`;
	preview.style.transform = `scale(${zoom.value})`;
	source.dataset.imagePosition = position.value;
	source.dataset.imageZoom = zoom.value;
};

const wireImageCrop = (source, preview, frame, position, zoom) => {
	updateImageCrop(source, preview, frame, position, zoom);
	position.addEventListener("change", () => updateImageCrop(source, preview, frame, position, zoom));
	zoom.addEventListener("input", () => updateImageCrop(source, preview, frame, position, zoom));
	frame.addEventListener("pointerdown", (event) => {
		if (frame.hidden) return;
		frame.setPointerCapture(event.pointerId);
		frame.dataset.dragX = String(event.clientX);
		frame.dataset.dragY = String(event.clientY);
		frame.dataset.startFocusX = source.dataset.imageFocusX ?? "50";
		frame.dataset.startFocusY = source.dataset.imageFocusY ?? "50";
	});
	frame.addEventListener("pointermove", (event) => {
		if (!frame.hasPointerCapture(event.pointerId)) return;
		const bounds = frame.getBoundingClientRect();
		source.dataset.imageFocusX = String(
			Math.max(0, Math.min(100, Number(frame.dataset.startFocusX) - ((event.clientX - Number(frame.dataset.dragX)) / bounds.width) * 100)),
		);
		source.dataset.imageFocusY = String(
			Math.max(0, Math.min(100, Number(frame.dataset.startFocusY) - ((event.clientY - Number(frame.dataset.dragY)) / bounds.height) * 100)),
		);
		updateImageCrop(source, preview, frame, position, zoom);
	});
};

const wireImageUpload = (input, preview, frame, source, status, clear) => {
	input.addEventListener("change", () => {
		const file = input.files?.[0];
		if (!file) return;
		const uploadId = String(Number(input.dataset.uploadId ?? 0) + 1);
		input.dataset.uploadId = uploadId;
		input.dataset.uploadError = "";
		status.textContent = "Téléversement de l’image…";
		if (input.dataset.previewUrl) URL.revokeObjectURL(input.dataset.previewUrl);
		input.dataset.previewUrl = URL.createObjectURL(file);
		frame.hidden = false;
		preview.src = input.dataset.previewUrl;
		const form = new FormData();
		form.append("file", file);

		const task = fetch("/api/article-images", {
			method: "POST",
			body: form,
			signal: AbortSignal.timeout(30000),
		})
			.then(async (response) => {
				if (response.status === 401) {
					location.replace(LOGIN);
					throw new Error("Session expirée pendant le téléversement");
				}
				if (!response.ok) throw new Error(`Image upload failed (${response.status})`);
				return response.json();
			})
			.then(({ src }) => {
				if (input.dataset.uploadId !== uploadId) return;
				source.dataset.imageSrc = src;
				preview.src = src;
				URL.revokeObjectURL(input.dataset.previewUrl);
				delete input.dataset.previewUrl;
				input.dataset.uploadError = "";
				status.textContent = "Image prête à être enregistrée avec l’article.";
				clear.hidden = false;
			})
			.catch((error) => {
				if (input.dataset.uploadId !== uploadId) return;
				input.dataset.uploadError = "true";
				if (input.dataset.previewUrl) URL.revokeObjectURL(input.dataset.previewUrl);
				delete input.dataset.previewUrl;
				preview.removeAttribute("src");
				frame.hidden = true;
				status.textContent = "Échec du téléversement. Réessayez avec une image JPEG, PNG ou WebP de 5 Mo maximum.";
				console.error(error);
				toast("Impossible de téléverser l’image");
			});

		imageUploads.add(task);
		task.finally(() => imageUploads.delete(task));
	});
};

const clearImageUpload = (input, preview, frame, source, status, clear) => {
	input.dataset.uploadId = String(Number(input.dataset.uploadId ?? 0) + 1);
	input.dataset.imageSrc = "";
	input.dataset.uploadError = "";
	input.value = "";
	source.dataset.imageSrc = "";
	if (input.dataset.previewUrl) URL.revokeObjectURL(input.dataset.previewUrl);
	delete input.dataset.previewUrl;
	preview.removeAttribute("src");
	frame.hidden = true;
	status.textContent = "";
	clear.hidden = true;
};

const heroImageInput = $("articleHeroImage");
const heroImageFields = $("articleHeroImageFields");
const heroImagePreview = $("articleHeroPreview");
const heroImageCrop = $("articleHeroCrop");
const heroImageStatus = $("articleHeroImageStatus");
const heroImagePosition = $("articleHeroPosition");
const heroImageZoom = $("articleHeroZoom");
const heroImageClear = $("articleHeroImageClear");
wireImageCrop(heroImageFields, heroImagePreview, heroImageCrop, heroImagePosition, heroImageZoom);
wireImageUpload(heroImageInput, heroImagePreview, heroImageCrop, heroImageFields, heroImageStatus, heroImageClear);
heroImageClear.addEventListener("click", () =>
	clearImageUpload(heroImageInput, heroImagePreview, heroImageCrop, heroImageFields, heroImageStatus, heroImageClear),
);

/**
 * Render status badge
 * @param {boolean} enabled - Maintenance on
 * @return {void}
 */

const renderStatus = (enabled) => {
	$("statusBadge").className = `status-badge status-${enabled ? "maintenance" : "online"}`;
	$("statusBadge").replaceChildren(
		Object.assign(document.createElement("span"), { className: "status-dot" }),
		enabled ? "Maintenance activée" : "Site opérationnel",
	);
	$("statusDetail").textContent = enabled ? "Les visiteurs voient la page de maintenance." : "Tous les visiteurs peuvent accéder au site normalement.";
	$("dashStatus").textContent = enabled ? "🟠" : "🟢";
};

let timer;

/**
 * Render countdown
 * @param {{ enabled: boolean, endTime: string|null }} state - Maintenance state
 * @return {void}
 */

const renderCountdown = ({ enabled, endTime }) => {
	clearInterval(timer);
	const tick = () => {
		const remaining = new Date(endTime) - Date.now();
		$("countdown-display").hidden = !enabled || !endTime || remaining <= 0;
		const total = Math.max(0, Math.floor(remaining / 1000));
		$("countdown-text").textContent = [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60].map(pad).join(":");
	};
	tick();
	if (enabled && endTime) timer = setInterval(tick, 1000);
};

/**
 * Render full state
 * @param {{ enabled: boolean, endTime: string|null }} state - Maintenance state
 * @return {void}
 */

const render = (state) => {
	$("maintenanceToggle").checked = state.enabled;
	$("maintenanceEnd").value = state.endTime ? toInputValue(state.endTime) : "";
	renderStatus(state.enabled);
	renderCountdown(state);
};

registerActions({
	section: (id, el) => {
		document.querySelectorAll(".section, .nav-item").forEach((node) => node.classList.remove("active"));
		$(id).classList.add("active");
		el.classList.add("active");
	},
	logout: async () => {
		await request("/api/logout", {});
		location.replace(LOGIN);
	},
});

/**
 * Save maintenance
 * @param {SubmitEvent} event - Submit event
 * @return {Promise<void>}
 */

const save = async (event) => {
	event.preventDefault();

	// Build state
	const end = $("maintenanceEnd").value;
	const state = {
		enabled: $("maintenanceToggle").checked,
		endTime: end ? new Date(end).toISOString() : null,
	};

	// Persist state
	const response = await request("/api/maintenance", state).catch(() => null);
	if (response?.status === 401) return location.replace(LOGIN);
	if (!response?.ok) return toast("Échec de la sauvegarde");
	render(state);
	toast("Paramètres sauvegardés");
};

$("maintenanceForm").addEventListener("submit", save);

$("maintenanceToggle").addEventListener("change", (event) => renderStatus(event.target.checked));

let articles = [];
let editingSlug = null;
let editingHasStaticPage = false;

const statusLabels = {
	"in-progress": "En cours",
	planned: "Prévu",
	published: "Publié",
};

const slugify = (value) =>
	stripInlineMarkdown(value)
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "") || "article";

const setEditorVisible = (visible) => {
	document.querySelector(".article-list-view").hidden = visible;
	document.querySelector(".article-editor-view").hidden = !visible;
};

const renderArticleList = () => {
	const list = $("article-list");
	list.replaceChildren();
	if (!articles.length) {
		const empty = document.createElement("div");
		empty.className = "card article-empty";
		empty.textContent = "Aucun article créé pour le moment. Commencez avec le modèle éditorial.";
		list.append(empty);
		return;
	}

	for (const article of articles) {
		const row = document.createElement("article");
		row.className = "card article-list-row";
		const details = document.createElement("div");
		details.className = "article-list-details";
		const badge = document.createElement("span");
		badge.className = `article-status article-status-${article.status}`;
		badge.textContent = statusLabels[article.status];
		let source;
		if (article.builtin) {
			source = document.createElement("span");
			source.className = "article-source";
			source.textContent = "Travail existant";
		}
		const domain = document.createElement("span");
		domain.className = "article-list-domain";
		domain.textContent = article.domain;
		const heading = document.createElement("h2");
		appendInlineMarkdown(heading, article.title);
		const description = document.createElement("p");
		appendInlineMarkdown(description, article.desc);
		details.append(badge);
		if (source) details.append(source);
		details.append(domain, heading, description);
		const actions = document.createElement("div");
		actions.className = "article-list-actions";
		const edit = document.createElement("button");
		edit.className = "article-action-btn";
		edit.type = "button";
		edit.dataset.action = "article-edit";
		edit.dataset.arg = article.slug;
		edit.textContent = "Modifier";
		const remove = document.createElement("button");
		remove.className = "article-action-btn article-delete-btn";
		remove.type = "button";
		remove.dataset.action = "article-remove";
		remove.dataset.arg = article.slug;
		remove.textContent = "Supprimer";
		actions.append(edit, remove);
		row.append(details, actions);
		list.append(row);
	}
};

let dynamicFieldId = 0;
let editingBuiltin = false;

const appendField = (parent, labelText, field, options = {}) => {
	const group = document.createElement("div");
	group.className = "article-dynamic-field";
	const label = document.createElement("label");
	label.textContent = labelText;
	field.id = `article-field-${++dynamicFieldId}`;
	label.htmlFor = field.id;
	field.className = "article-input";
	if (options.rich) field.dataset.richText = "";
	if (options.rich) field.dataset.richText = "";
	if (options.placeholder) field.placeholder = options.placeholder;
	group.append(label, field);
	parent.append(group);
};

const createSectionImageEditor = (image = {}, fieldNames = ["image-alt", "image-caption"], labelText = "Image de la section (facultative)") => {
	const fields = document.createElement("div");
	fields.className = "article-image-fields";
	fields.dataset.imageSrc = image.src ?? "";
	fields.dataset.imagePosition = image.position ?? "above";
	fields.dataset.imageZoom = String(image.zoom ?? 1);
	fields.dataset.imageFocusX = String(image.focusX ?? 50);
	fields.dataset.imageFocusY = String(image.focusY ?? 50);

	const fileLabel = document.createElement("label");
	fileLabel.className = "input-label";
	fileLabel.textContent = labelText;
	const input = document.createElement("input");
	input.type = "file";
	input.accept = "image/jpeg,image/png,image/webp";
	input.className = "article-input";
	const position = document.createElement("select");
	position.className = "article-input article-image-position";
	for (const [value, label] of [
		["above", "Horizontale au-dessus du texte"],
		["below", "Horizontale en dessous du texte"],
		["left", "Verticale à gauche du texte"],
		["right", "Verticale à droite du texte"],
	]) {
		const option = document.createElement("option");
		option.value = value;
		option.textContent = label;
		position.append(option);
	}
	position.value = image.position ?? "above";
	appendField(fields, "Disposition de l’image", position);
	position.classList.add("article-image-position");
	const frame = document.createElement("div");
	frame.className = "article-image-crop";
	frame.hidden = !image.src;
	const preview = document.createElement("img");
	preview.className = "article-image-preview";
	preview.alt = "";
	preview.draggable = false;
	if (image.src) preview.src = image.src;
	frame.append(preview);
	const zoom = document.createElement("input");
	zoom.type = "range";
	zoom.min = "1";
	zoom.max = "3";
	zoom.step = "0.05";
	zoom.value = String(image.zoom ?? 1);
	appendField(fields, "Zoom du recadrage", zoom);
	zoom.classList.add("article-image-zoom");
	const cropHelp = document.createElement("p");
	cropHelp.className = "article-image-crop-help";
	cropHelp.textContent = "Faites glisser l’image pour ajuster son cadrage.";
	const status = document.createElement("p");
	status.className = "article-image-upload-status";
	const alt = document.createElement("input");
	alt.dataset.field = fieldNames[0];
	alt.maxLength = 240;
	alt.value = image.alt ?? "";
	appendField(fields, "Description de l’image (facultative)", alt);
	const caption = document.createElement("input");
	caption.dataset.field = fieldNames[1];
	caption.maxLength = 300;
	caption.value = image.caption ?? "";
	appendField(fields, "Légende (facultative)", caption);
	const clear = document.createElement("button");
	clear.type = "button";
	clear.className = "article-remove-btn";
	clear.textContent = "Retirer l’image";
	clear.hidden = !image.src;
	clear.addEventListener("click", () => clearImageUpload(input, preview, frame, fields, status, clear));
	const positionField = position.parentElement;
	const zoomField = zoom.parentElement;
	fields.prepend(fileLabel, input, positionField, frame, zoomField, cropHelp, status);
	wireImageCrop(fields, preview, frame, position, zoom);
	wireImageUpload(input, preview, frame, fields, status, clear);
	return { fields, clear };
};

const addArticleSection = (section = {}) => {
	const wrapper = document.createElement("div");
	wrapper.className = "article-section-field";
	const heading = document.createElement("div");
	heading.className = "article-section-field-heading";
	const number = document.createElement("span");
	number.textContent = `Section ${$("article-sections").children.length + 1}`;
	const remove = document.createElement("button");
	remove.type = "button";
	remove.className = "article-remove-btn";
	remove.dataset.action = "article-remove-section";
	remove.textContent = "Retirer";
	heading.append(number, remove);
	const fields = document.createElement("div");
	fields.className = "article-form-grid";
	const label = document.createElement("input");
	label.dataset.field = "label";
	label.dataset.richText = "";
	label.maxLength = 80;
	label.value = section.label ?? "";
	appendField(fields, "Repère (ex. Introduction)", label);
	const title = document.createElement("input");
	title.dataset.field = "title";
	title.dataset.richText = "";
	title.maxLength = 180;
	title.value = section.title ?? "";
	appendField(fields, "Titre de section", title);
	const body = document.createElement("textarea");
	body.dataset.field = "body";
	body.dataset.richText = "";
	body.maxLength = 12000;
	body.rows = 5;
	body.value = section.body ?? "";
	appendField(fields, "Texte", body);
	wrapper.append(heading, fields);
	const imageEditor = createSectionImageEditor(section.image);
	imageEditor.fields.classList.add("article-section-image-editor");
	wrapper.append(imageEditor.fields, imageEditor.clear);
	const boxType = document.createElement("select");
	boxType.className = "article-input article-box-type";
	boxType.dataset.boxType = "";
	for (const [value, text] of [
		["definition", "Encadré clair"],
		["highlight", "Encadré bleu nuit"],
		["stats", "Chiffres clés"],
		["image", "Image"],
		["conclusion", "Encadré de conclusion"],
	]) {
		const option = document.createElement("option");
		option.value = value;
		option.textContent = text;
		boxType.append(option);
	}
	const addBox = document.createElement("button");
	addBox.type = "button";
	addBox.className = "article-add-btn article-box-add-btn";
	addBox.dataset.action = "article-add-box";
	addBox.textContent = "+ Ajouter un encadré";
	const boxToolbar = document.createElement("div");
	boxToolbar.className = "article-box-toolbar";
	boxToolbar.append(boxType, addBox);
	const boxes = document.createElement("div");
	boxes.className = "article-box-fields";
	for (const box of section.boxes ?? []) addArticleBox(boxes, box);
	wrapper.append(boxToolbar, boxes);
	$("article-sections").append(wrapper);
};

const addArticleBox = (container, box = {}) => {
	const wrapper = document.createElement("div");
	wrapper.className = `article-box-field article-box-${box.type}`;
	wrapper.dataset.boxType = box.type;
	const heading = document.createElement("div");
	heading.className = "article-section-field-heading";
	const typeNames = {
		definition: "Encadré clair",
		highlight: "Encadré bleu nuit",
		stats: "Chiffres clés",
		image: "Image",
		conclusion: "Encadré de conclusion",
	};
	const type = document.createElement("span");
	type.textContent = typeNames[box.type];
	const remove = document.createElement("button");
	remove.type = "button";
	remove.className = "article-remove-btn";
	remove.dataset.action = "article-remove-box";
	remove.textContent = "Retirer";
	heading.append(type, remove);
	wrapper.append(heading);

	if (box.type === "stats") {
		const items = document.createElement("div");
		items.className = "article-stat-fields";
		for (const item of box.items ?? [{ value: "", label: "" }]) {
			const row = document.createElement("div");
			row.className = "article-stat-field";
			const value = document.createElement("input");
			value.dataset.field = "value";
			value.dataset.richText = "";
			value.maxLength = 32;
			value.value = item.value ?? "";
			appendField(row, "Chiffre ou donnée", value, { placeholder: "50,1 %" });
			const label = document.createElement("input");
			label.dataset.field = "label";
			label.dataset.richText = "";
			label.maxLength = 160;
			label.value = item.label ?? "";
			appendField(row, "Explication", label, { placeholder: "ESPT chez les personnes exposées…" });
			const removeItem = document.createElement("button");
			removeItem.type = "button";
			removeItem.className = "article-remove-btn";
			removeItem.dataset.action = "article-remove-stat";
			removeItem.textContent = "Retirer";
			row.append(removeItem);
			items.append(row);
		}
		const addItem = document.createElement("button");
		addItem.type = "button";
		addItem.className = "article-add-btn";
		addItem.dataset.action = "article-add-stat";
		addItem.textContent = "+ Ajouter un chiffre";
		wrapper.append(items, addItem);
	} else if (box.type === "image") {
		const imageEditor = createSectionImageEditor(box, ["alt", "caption"], "Image (facultative)");
		wrapper.append(imageEditor.fields, imageEditor.clear);
	} else {
		if (box.type !== "conclusion") {
			const title = document.createElement("input");
			title.dataset.field = "title";
			title.dataset.richText = "";
			title.maxLength = 180;
			title.value = box.title ?? "";
			appendField(wrapper, box.type === "highlight" ? "Titre de l’encadré" : "Terme ou titre", title);
		}
		const body = document.createElement("textarea");
		body.dataset.field = "body";
		body.dataset.richText = "";
		body.rows = 3;
		body.maxLength = 2000;
		body.value = box.body ?? "";
		appendField(wrapper, box.type === "conclusion" ? "Texte de conclusion" : "Texte de l’encadré", body);
	}
	container.append(wrapper);
	return wrapper;
};

const addArticleReference = (reference = {}) => {
	const wrapper = document.createElement("div");
	wrapper.className = "article-reference-field";
	const title = document.createElement("input");
	title.dataset.field = "title";
	title.dataset.richText = "";
	title.maxLength = 300;
	title.value = reference.title ?? "";
	appendField(wrapper, "Référence bibliographique", title, { placeholder: "Auteur. Titre de la publication, année.", rich: true });
	const url = document.createElement("input");
	url.dataset.field = "url";
	url.type = "url";
	url.value = reference.url ?? "";
	appendField(wrapper, "Lien HTTPS (facultatif)", url, { placeholder: "https://…" });
	const remove = document.createElement("button");
	remove.type = "button";
	remove.className = "article-remove-btn";
	remove.dataset.action = "article-remove-reference";
	remove.textContent = "Retirer la référence";
	wrapper.append(remove);
	$("article-references").append(wrapper);
};

const openArticleEditor = (article) => {
	editingSlug = article?.slug ?? null;
	editingBuiltin = Boolean(article?.builtin);
	editingHasStaticPage = Boolean(article?.href);
	$("articleForm").reset();
	heroImageInput.dataset.uploadId = String(Number(heroImageInput.dataset.uploadId ?? 0) + 1);
	$("article-sections").replaceChildren();
	$("article-references").replaceChildren();
	$("article-editor-title").textContent = article ? (article.builtin ? "Modifier le travail" : "Modifier l’article") : "Nouvel article";
	$("articleTitle").value = article?.title ?? "";
	$("articleDomain").value = article?.domain ?? "Santé publique";
	$("articleStatus").value = article?.status ?? "in-progress";
	$("articleDesc").value = article?.desc ?? "";
	$("articleIntro").value = article?.intro ?? "";
	heroImageInput.value = "";
	heroImageFields.dataset.imageSrc = article?.heroImage?.src ?? "";
	heroImageInput.dataset.uploadError = "";
	$("articleHeroAlt").value = article?.heroImage?.alt ?? "";
	heroImageFields.dataset.imagePosition = article?.heroImage?.position ?? "right";
	heroImageFields.dataset.imageZoom = String(article?.heroImage?.zoom ?? 1);
	heroImageFields.dataset.imageFocusX = String(article?.heroImage?.focusX ?? 50);
	heroImageFields.dataset.imageFocusY = String(article?.heroImage?.focusY ?? 50);
	heroImagePosition.value = heroImageFields.dataset.imagePosition;
	heroImageZoom.value = heroImageFields.dataset.imageZoom;
	heroImageCrop.hidden = !article?.heroImage?.src;
	if (article?.heroImage?.src) heroImagePreview.src = article.heroImage.src;
	else heroImagePreview.removeAttribute("src");
	updateImageCrop(heroImageFields, heroImagePreview, heroImageCrop, heroImagePosition, heroImageZoom);
	heroImageStatus.textContent = "";
	$("articleHeroImageClear").hidden = !article?.heroImage?.src;
	const sections =
		article?.sections ??
		(article?.builtin
			? []
			: [
					{ label: "Introduction", title: "Contexte et objectifs", body: "" },
					{ label: "Analyse", title: "Résultats et discussion", body: "" },
					{ label: "Conclusion", title: "À retenir", body: "" },
				]);
	sections.forEach(addArticleSection);
	(article?.references ?? []).forEach(addArticleReference);
	document.querySelector(".article-builtin-note").hidden = !article?.builtin;
	setEditorVisible(true);
	$("articleTitle").focus();
};

const saveArticles = async (next) => {
	const response = await request("/api/studies", { articles: next }).catch(() => null);
	if (response?.status === 401) {
		location.replace(LOGIN);
		return false;
	}
	if (!response?.ok) {
		toast(response?.status === 400 ? "Vérifiez les champs de l’article" : "Échec de l’enregistrement");
		return false;
	}
	const result = await response.json();
	articles = result.articles;
	renderArticleList();
	return true;
};

const collectArticle = () => ({
	slug: editingSlug ?? slugify($("articleTitle").value),
	builtin: editingBuiltin,
	status: $("articleStatus").value,
	title: $("articleTitle").value.trim(),
	domain: $("articleDomain").value.trim(),
	desc: $("articleDesc").value.trim(),
	intro: $("articleIntro").value.trim(),
	...(heroImageFields.dataset.imageSrc
		? {
				heroImage: {
					src: heroImageFields.dataset.imageSrc,
					alt: $("articleHeroAlt").value.trim(),
					position: heroImageFields.dataset.imagePosition,
					zoom: Number(heroImageFields.dataset.imageZoom),
					focusX: Number(heroImageFields.dataset.imageFocusX),
					focusY: Number(heroImageFields.dataset.imageFocusY),
				},
			}
		: {}),
	sections: [...$("article-sections").children].map((element) => ({
		label: element.querySelector('[data-field="label"]').value.trim(),
		title: element.querySelector('[data-field="title"]').value.trim(),
		body: element.querySelector('[data-field="body"]').value.trim(),
		...(element.querySelector(".article-section-image-editor").dataset.imageSrc
			? {
					image: (() => {
						const image = element.querySelector(".article-section-image-editor");
						return {
							src: image.dataset.imageSrc,
							alt: image.querySelector('[data-field="image-alt"]').value.trim(),
							caption: image.querySelector('[data-field="image-caption"]').value.trim(),
							position: image.dataset.imagePosition,
							zoom: Number(image.dataset.imageZoom),
							focusX: Number(image.dataset.imageFocusX),
							focusY: Number(image.dataset.imageFocusY),
						};
					})(),
				}
			: {}),
		boxes: [...element.querySelector(".article-box-fields").children]
			.map((box) => ({
				type: box.dataset.boxType,
				...(box.dataset.boxType === "stats"
					? {
							items: [...box.querySelector(".article-stat-fields").children].map((item) => ({
								value: item.querySelector('[data-field="value"]').value.trim(),
								label: item.querySelector('[data-field="label"]').value.trim(),
							})),
						}
					: box.dataset.boxType === "conclusion"
						? { body: box.querySelector('[data-field="body"]').value.trim() }
						: box.dataset.boxType === "image"
							? box.querySelector(".article-image-fields").dataset.imageSrc
								? {
										src: box.querySelector(".article-image-fields").dataset.imageSrc,
										alt: box.querySelector('[data-field="alt"]').value.trim(),
										caption: box.querySelector('[data-field="caption"]').value.trim(),
										position: box.querySelector(".article-image-fields").dataset.imagePosition,
										zoom: Number(box.querySelector(".article-image-fields").dataset.imageZoom),
										focusX: Number(box.querySelector(".article-image-fields").dataset.imageFocusX),
										focusY: Number(box.querySelector(".article-image-fields").dataset.imageFocusY),
									}
								: null
							: {
									title: box.querySelector('[data-field="title"]').value.trim(),
									body: box.querySelector('[data-field="body"]').value.trim(),
								}),
			}))
			.filter(Boolean),
	})),
	references: [...$("article-references").children]
		.map((element) => ({
			title: element.querySelector('[data-field="title"]').value.trim(),
			url: element.querySelector('[data-field="url"]').value.trim(),
		}))
		.filter((reference) => reference.title || reference.url),
});

const formatToolbar = $("article-format-toolbar");
document.body.append(formatToolbar);
let richSelection = null;

const hideFormatToolbar = () => {
	formatToolbar.hidden = true;
};

const updateFormatToolbar = (field) => {
	if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) || !field.hasAttribute("data-rich-text")) {
		hideFormatToolbar();
		return;
	}
	const start = field.selectionStart;
	const end = field.selectionEnd;
	if (start === end) {
		hideFormatToolbar();
		return;
	}
	richSelection = { field, start, end };
	const bounds = field.getBoundingClientRect();
	const computed = getComputedStyle(field);
	const mirror = document.createElement("div");
	mirror.setAttribute("aria-hidden", "true");
	Object.assign(mirror.style, {
		position: "fixed",
		visibility: "hidden",
		pointerEvents: "none",
		left: `${bounds.left}px`,
		top: `${bounds.top}px`,
		width: `${field.clientWidth}px`,
		height: `${field.clientHeight}px`,
		boxSizing: computed.boxSizing,
		overflow: "hidden",
		padding: computed.padding,
		border: computed.border,
		font: computed.font,
		letterSpacing: computed.letterSpacing,
		textAlign: computed.textAlign,
		textIndent: computed.textIndent,
		textTransform: computed.textTransform,
		wordSpacing: computed.wordSpacing,
		tabSize: computed.tabSize,
		whiteSpace: field instanceof HTMLTextAreaElement ? "pre-wrap" : "pre",
		overflowWrap: field instanceof HTMLTextAreaElement ? "break-word" : "normal",
	});
	const before = document.createTextNode(field.value.slice(0, start));
	const marker = document.createElement("span");
	marker.textContent = "\u200b";
	mirror.append(before, marker, document.createTextNode(field.value.slice(start)));
	document.body.append(mirror);
	const selectionRect = marker.getBoundingClientRect();
	const selectionTop = selectionRect.top - field.scrollTop;
	const selectionLeft = selectionRect.left - field.scrollLeft;
	mirror.remove();
	formatToolbar.hidden = false;
	const left = Math.max(8, Math.min(selectionLeft, window.innerWidth - formatToolbar.offsetWidth - 8));
	const aboveTop = selectionTop - formatToolbar.offsetHeight - 8;
	const belowTop = selectionTop + selectionRect.height + 8;
	formatToolbar.style.left = `${left}px`;
	formatToolbar.style.top = `${aboveTop >= 8 ? aboveTop : belowTop}px`;
};

const wrapRichSelection = (prefix, suffix) => {
	if (!richSelection) return;
	const { field, start, end } = richSelection;
	const selected = field.value.slice(start, end);
	const nextValue = `${field.value.slice(0, start)}${prefix}${selected}${suffix}${field.value.slice(end)}`;
	if (field.maxLength > 0 && nextValue.length > field.maxLength) {
		toast("La mise en forme dépasse la limite de caractères de ce champ");
		return;
	}
	field.value = nextValue;
	field.focus();
	field.setSelectionRange(start + prefix.length, end + prefix.length);
	field.dispatchEvent(new Event("input", { bubbles: true }));
	richSelection = { field, start: start + prefix.length, end: end + prefix.length };
	updateFormatToolbar(field);
};

for (const eventName of ["mouseup", "keyup", "select"]) {
	$("articleForm").addEventListener(eventName, (event) => {
		if (event.target.matches("[data-rich-text]")) updateFormatToolbar(event.target);
	});
}

document.addEventListener("selectionchange", () => {
	const active = document.activeElement;
	if (active?.matches?.("#articleForm [data-rich-text]")) updateFormatToolbar(active);
	else hideFormatToolbar();
});

formatToolbar.addEventListener("mousedown", (event) => {
	if (event.target.closest("button")) event.preventDefault();
});
formatToolbar.addEventListener("click", (event) => {
	const action = event.target.closest("[data-format]")?.dataset.format;
	if (action === "bold") wrapRichSelection("**", "**");
	else if (action === "italic") wrapRichSelection("*", "*");
	else if (action === "underline") wrapRichSelection("++", "++");
});
formatToolbar.querySelector("[data-format-color]").addEventListener("change", (event) => {
	const color = event.target.value.toLowerCase();
	wrapRichSelection(`[[${color}|`, "]]");
});

registerActions({
	"article-new": () => openArticleEditor(null),
	"article-list": () => setEditorVisible(false),
	"article-edit": (slug) => {
		const article = articles.find((item) => item.slug === slug);
		if (article) openArticleEditor(article);
	},
	"article-add-section": () => addArticleSection(),
	"article-remove-section": (_arg, element) => {
		element.closest(".article-section-field").remove();
		[...$("article-sections").children].forEach((section, index) => {
			section.querySelector(".article-section-field-heading span").textContent = `Section ${index + 1}`;
		});
	},
	"article-add-box": (_arg, element) => {
		const section = element.closest(".article-section-field");
		const boxes = section.querySelector(".article-box-fields");
		if (boxes.children.length >= 12) return toast("Maximum 12 encadrés par section");
		const body = section.querySelector('[data-field="body"]');
		const start = body.selectionStart;
		const end = body.selectionEnd;
		const selectedText = body.value.slice(start, end).trim();
		const type = section.querySelector("[data-box-type]").value;
		if (selectedText && type === "stats" && selectedText.length > 32) return toast("Sélectionnez uniquement la valeur du chiffre clé (32 caractères maximum)");
		if (selectedText && !["stats", "image"].includes(type) && selectedText.length > 2000)
			return toast("Le texte sélectionné dépasse la limite de 2 000 caractères");

		const box =
			type === "stats"
				? { type, items: [{ value: selectedText, label: "" }] }
				: type === "image"
					? { type }
					: type === "conclusion"
						? { type, body: selectedText }
						: { type, title: "", body: selectedText };
		const boxElement = addArticleBox(boxes, box);
		if (selectedText && type !== "image") {
			const before = body.value.slice(0, start);
			const after = body.value.slice(end);
			const separator = before && after && !/\s$/.test(before) && !/^\s/.test(after) ? " " : "";
			body.value = before + separator + after;
			body.focus();
			body.setSelectionRange(start, start);
			toast("Texte déplacé dans l’encadré");
		}
		const nextField =
			boxElement.querySelector('[data-field="label"]') ?? boxElement.querySelector('[data-field="title"]') ?? boxElement.querySelector('[data-field="body"]');
		nextField?.focus();
	},
	"article-remove-box": (_arg, element) => element.closest(".article-box-field").remove(),
	"article-clear-image": (_arg, element) => {
		const box = element.closest(".article-box-field");
		const fields = box.querySelector(".article-image-fields");
		clearImageUpload(
			fields.querySelector('input[type="file"]'),
			fields.querySelector(".article-image-preview"),
			fields,
			fields.querySelector(".article-image-upload-status"),
		);
	},
	"article-add-stat": (_arg, element) => {
		const box = element.closest(".article-box-field");
		const items = box.querySelector(".article-stat-fields");
		if (items.children.length >= 3) return toast("Maximum 3 chiffres par encadré");
		const newBox = document.createElement("div");
		newBox.className = "article-stat-field";
		for (const [field, labelText] of [
			["value", "Chiffre ou donnée"],
			["label", "Explication"],
		]) {
			const input = document.createElement("input");
			input.dataset.field = field;
			input.maxLength = field === "value" ? 32 : 160;
			appendField(newBox, labelText, input);
		}
		const removeItem = document.createElement("button");
		removeItem.type = "button";
		removeItem.className = "article-remove-btn";
		removeItem.dataset.action = "article-remove-stat";
		removeItem.textContent = "Retirer";
		newBox.append(removeItem);
		items.append(newBox);
	},
	"article-remove-stat": (_arg, element) => element.closest(".article-stat-field").remove(),
	"article-add-reference": () => addArticleReference(),
	"article-remove-reference": (_arg, element) => element.closest(".article-reference-field").remove(),
	"article-remove": async (slug) => {
		const article = articles.find((item) => item.slug === slug);
		if (!article || !confirm(`Supprimer « ${article.title} » ?`)) return;
		if (await saveArticles(articles.filter((item) => item.slug !== slug))) toast("Article supprimé");
	},
});

$("articleForm").addEventListener("submit", async (event) => {
	event.preventDefault();
	if (imageUploads.size) await Promise.all([...imageUploads]);
	if (document.querySelector('#articleForm [data-upload-error="true"]')) {
		toast("Réessayez le téléversement des images avant d’enregistrer");
		return;
	}
	const article = collectArticle();
	if (
		article.status === "published" &&
		((!article.sections.length && !(article.builtin && editingHasStaticPage)) || article.sections.some(({ label, title, body }) => !label || !title || !body))
	) {
		toast("Complétez chaque section avant de publier");
		return;
	}
	if (!editingSlug && (RESERVED_SLUGS.has(article.slug) || articles.some((item) => item.slug === article.slug))) {
		let suffix = 2;
		while (RESERVED_SLUGS.has(`${article.slug}-${suffix}`) || articles.some((item) => item.slug === `${article.slug}-${suffix}`)) suffix++;
		article.slug = `${article.slug}-${suffix}`;
	}
	const next = editingSlug ? articles.map((item) => (item.slug === editingSlug ? article : item)) : [...articles, article];
	if (await saveArticles(next)) {
		toast(article.status === "published" ? "Article publié" : "Article enregistré");
		setEditorVisible(false);
	}
});

// Session gate
const session = await request("/api/session").catch(() => null);
if (session?.status === 401) location.replace(LOGIN);
else if (!session?.ok) toast("Impossible de vérifier la session");
else {
	render(
		await request("/api/maintenance")
			.then((response) => response.json())
			.catch(() => ({ enabled: false, endTime: null })),
	);
	const response = await request("/api/studies?admin=1").catch(() => null);
	if (response?.status === 401) location.replace(LOGIN);
	else if (!response?.ok) toast("Impossible de charger les articles");
	else {
		articles = (await response.json()).articles;
		renderArticleList();
	}
}
