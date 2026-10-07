import { initLanguage, t, tVal } from "../../core/languageService.js";
import { Icons } from "../../utils/icons.js";
import site from "../../config/data/site.json";
import { sectors } from "../../config/data/sectors.json";
import { services } from "../../config/data/services.json";
import { members } from "../../config/data/team.json";
import { registerActions } from "./actions.js";

const TYPEWRITER_MS = 16;
const THINKING_MS = 700;
const BADGE_MS = 3000;

const DETAIL_SERVICES = {
	service_biostats: "biostats",
	service_travail: "travail",
	service_sante_pub: "sante-pub",
	service_audit: "audit",
	service_formation: "formation",
	service_recherche: "recherche",
};

let isOpen = false;
let isBusy = false;
let hasGreeted = false;

/**
 * Element by ID
 * @param {string} id - Element ID
 * @return {HTMLElement} - Matching element
 */

const $ = (id) => document.getElementById(id);
/**
 * Delay promise
 * @param {number} ms - Milliseconds
 * @return {Promise<void>} - Resolves after delay
 */

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
/**
 * Intent string key
 * @param {string} intent - Intent ID
 * @param {string} field - Field name
 * @return {string} - Dotted key
 */

const key = (intent, field) => `chatbot.intents.${intent}.${field}`;
/**
 * HTML list
 * @param {string[]} items - Item markup
 * @param {string} [className] - List class
 * @return {string} - List markup
 */

const list = (items, className = "") => {
	const attribute = className ? ` class="${className}"` : "";
	const rows = items.map((item) => `<li>${item}</li>`).join("");
	return `<ul${attribute}>${rows}</ul>`;
};

/**
 * Inline icon
 * @param {string} name - Icon name
 * @return {string} - Icon markup
 */

const icon = (name) => `<span class="chat-icon-inline">${Icons[name]}</span>`;
/**
 * Arrow link
 * @param {string} href - Link target
 * @param {string} label - Link text
 * @return {string} - Link markup
 */

const link = (href, label) => `${icon("arrowRight")} <a href="${href}">${label}</a>`;
/**
 * CTA button link
 * @param {string} href - Link target
 * @param {string} label - Link text
 * @return {string} - Link markup
 */

const cta = (href, label) => `<a class="chat-cta-btn" href="${href}">${label}</a>`;
/**
 * Icon list items
 * @param {string} intent - Intent ID
 * @param {string} fallback - Default icon
 * @return {string} - List markup
 */

const iconItems = (intent, fallback) =>
	list(
		(tVal(key(intent, "items")) ?? []).map(
			({ icon: name, strong, text }) => `${icon(name in Icons ? name : fallback)}<span><strong>${strong}</strong> ${text}</span>`,
		),
		"chat-icon-list",
	);

/**
 * Normalize text
 * @param {string} text - Raw text
 * @return {string} - Plain lowercase
 */

const normalize = (text) =>
	text
		.toLowerCase()
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^a-z0-9\s]/g, " ")
		.replace(/\s+/g, " ")
		.trim();

/**
 * Service detail
 * @param {string} serviceKey - Service key
 * @return {string} - Detail markup
 */

const serviceDetail = (serviceKey) => {
	const { title, tagline, body1, body2 } = services.find((service) => service.key === serviceKey);
	return `<strong>${title}</strong><br><em>${tagline}</em><br><br>${body1}<br><br>${body2}`;
};

/**
 * Intent responders
 * @type {Record<string, () => string>}
 */

const RESPONDERS = {
	greeting: () => t(key("greeting", "message")),
	about: () => {
		const metrics = site.stats.filter(({ type }) => type === "metric").map(({ num, label }) => `<strong>${num}</strong> ${label}`);
		return t(key("about", "template"), {
			description: site.description,
			country: site.contact.country,
			stats: metrics.length ? ` · ${metrics.join(" · ")}` : "",
			pin: Icons.mapPin,
		});
	},
	services_all: () =>
		`${t(key("services_all", "intro"), { count: services.length })}<br>${list(services.map(({ title, tagline }) => `<strong>${title}</strong>, <em>${tagline}</em>`))}<br>${t(key("services_all", "outro"))}`,
	sectors: () =>
		`${t(key("sectors", "intro"), { count: sectors.length })}<br>${list(
			sectors.map(({ title, subtitle }) => `<strong>${title}</strong>${subtitle ? `, ${subtitle}` : ""}`),
			"chat-sector-list",
		)}`,
	team: () =>
		`${t(key("team", "intro"))}<br>${list(members.map(({ name, badge, role }) => `<strong>${name}</strong> <em>${badge}</em>, ${role}`))}<br>${link("/equipe/", t(key("team", "linkLabel")))}`,
	contact: () =>
		`${t(key("contact", "intro"))}<br><br>${icon("mail")} ${site.contact.email}<br>${icon("phone")} ${site.contact.phone}<br><br>${cta(t(key("contact", "ctaPage")), t(key("contact", "ctaLabel")))}`,
	process: () => {
		const { steps, quote } = site.method;
		return `${t(key("process", "intro"), { count: steps.length })}<br>${list(steps.map(({ num, title, desc }) => `${num}. <strong>${title}</strong> : ${desc}`))}<br><em>« ${quote} »</em>`;
	},
	pricing: () => `${t(key("pricing", "intro"))}<br>${iconItems("pricing", "check")}<br>${cta(t(key("pricing", "ctaPage")), t(key("pricing", "ctaLabel")))}`,
	delay: () => `${t(key("delay", "intro"))}<br>${iconItems("delay", "clock")}<br>${t(key("delay", "urgentNote"))}`,
	rgpd: () => `${t(key("rgpd", "intro"))}<br>${list(tVal(key("rgpd", "items")))}${link(t(key("rgpd", "linkPage")), t(key("rgpd", "linkLabel")))}`,
	results: () =>
		`${t(key("results", "intro"))}<br>${list(site.stats.filter(({ type }) => type === "metric").map(({ num, label }) => `<strong>${num}</strong> : ${label}`))}`,
	cookie: () => `${t(key("cookie", "message"))}<br><br><button class="chat-cta-btn" data-action="cookie-settings">${t(key("cookie", "ctaLabel"))}</button>`,
	legal: () =>
		`${t(key("legal", "intro"))}<br>${tVal(key("legal", "links"))
			.map(({ page, label }) => link(page, label))
			.join("<br>")}`,
	...Object.fromEntries(Object.entries(DETAIL_SERVICES).map(([id, serviceKey]) => [id, () => serviceDetail(serviceKey)])),
};

/**
 * Best matching intent
 * @param {string} input - User text
 * @return {string|null} - Intent ID
 */

const matchIntent = (input) => {
	const text = normalize(input);
	const scored = Object.keys(RESPONDERS).map((id) => ({
		id,
		score: (tVal(key(id, "patterns")) ?? []).filter((pattern) => text.includes(normalize(pattern))).length,
	}));
	const best = scored.reduce((top, item) => (item.score > top.score ? item : top), { score: 0 });
	return best.score ? best.id : null;
};

/**
 * Scroll to latest
 * @return {void}
 */

const scrollBottom = () => setTimeout(() => ($("chat-messages").scrollTop = $("chat-messages").scrollHeight), 40);

/**
 * Toggle typing dots
 * @param {boolean} visible - Show indicator
 * @return {void}
 */

const setTyping = (visible) => {
	$("chat-typing").classList.toggle("visible", visible);
	scrollBottom();
};

/**
 * Add chat message
 * @param {"bot"|"user"} role - Message author
 * @param {string} [content] - User text only
 * @return {HTMLElement} - Bubble element
 */

const addMessage = (role, content = "") => {
	const bubble = Object.assign(document.createElement("div"), {
		className: "chat-msg__bubble",
	});
	const wrap = Object.assign(document.createElement("div"), {
		className: `chat-msg chat-msg--${role}`,
	});
	if (role === "user") bubble.textContent = content;
	wrap.append(bubble);
	$("chat-messages").insertBefore(wrap, $("chat-typing"));
	scrollBottom();
	return bubble;
};

/**
 * Type bot message
 * @param {HTMLElement} bubble - Target bubble
 * @param {string} html - Trusted markup
 * @return {Promise<void>}
 */

const typeMessage = (bubble, html) =>
	new Promise((resolve) => {
		// Markup shows at once
		if (/<[a-z]/i.test(html)) {
			bubble.innerHTML = html;
			scrollBottom();
			return resolve();
		}

		// Plain text types out
		const chars = [...html];
		const timer = setInterval(() => {
			bubble.textContent += chars.shift();
			if (chars.length) return;
			clearInterval(timer);
			scrollBottom();
			resolve();
		}, TYPEWRITER_MS);
	});

/**
 * Show quick replies
 * @param {string[]} [replies] - Reply labels
 * @return {void}
 */

const showReplies = (replies = tVal("chatbot.quickReplies")) => {
	const buttons = replies.map((reply) =>
		Object.assign(document.createElement("button"), {
			className: "chat-quick-btn",
			textContent: reply,
			type: "button",
		}),
	);
	$("chat-quick-replies").replaceChildren(...buttons);
};

/**
 * Bot reply
 * @param {string} html - Trusted markup
 * @param {string[]} [followUps] - Follow-up chips
 * @return {Promise<void>}
 */

const reply = async (html, followUps) => {
	setTyping(true);
	await wait(THINKING_MS);
	setTyping(false);
	await typeMessage(addMessage("bot"), html);
	showReplies(followUps ?? tVal("chatbot.defaultFollowUps"));
};

/**
 * Answer user text
 * @param {string} text - User message
 * @return {Promise<void>}
 */

const ask = async (text) => {
	if (!text.trim() || isBusy) return;
	isBusy = true;

	// Show question
	$("chat-quick-replies").replaceChildren();
	addMessage("user", text);

	// Pick answer
	const intent = matchIntent(text);
	const field = intent in DETAIL_SERVICES ? "detailFollowUps" : "followUps";
	const group = intent in DETAIL_SERVICES ? "services_all" : intent;
	const html = intent ? RESPONDERS[intent]() : `${t("chatbot.fallback")}<br>${cta("/#rdv", t(key("contact", "ctaLabel")))}`;
	await reply(html, intent ? tVal(key(group, field)) : undefined);
	isBusy = false;
};

/**
 * Greet visitor
 * @return {Promise<void>}
 */

const greet = async () => {
	isBusy = true;
	await reply(RESPONDERS.greeting(), tVal("chatbot.quickReplies"));
	isBusy = false;
};

/**
 * Open or close
 * @param {boolean} open - Target state
 * @return {void}
 */

const setOpen = (open) => {
	// Toggle state
	isOpen = open;
	$("chat-window").classList.toggle("open", open);
	$("chat-toggle").classList.toggle("open", open);
	$("chat-toggle").setAttribute("aria-expanded", String(open));
	if (!open) return;

	// First open greeting
	$("chat-badge").classList.remove("visible");
	if (hasGreeted) scrollBottom();
	else {
		hasGreeted = true;
		void greet();
	}
	setTimeout(() => $("chat-input").focus(), 300);
};

/**
 * Restart conversation
 * @return {void}
 */

const restart = () => {
	if (isBusy) return;
	$("chat-messages")
		.querySelectorAll(".chat-msg")
		.forEach((el) => el.remove());
	$("chat-quick-replies").replaceChildren();
	void greet();
};

/**
 * Send input text
 * @return {void}
 */

const send = () => {
	const text = $("chat-input").value;
	$("chat-input").value = "";
	void ask(text);
};

/**
 * Build chat widget
 * @return {void}
 */

const buildUI = () => {
	// Widget markup
	const root = document.createElement("div");
	root.innerHTML = `
		<button id="chat-toggle" class="chat-toggle" data-action="chat-toggle" aria-label="${t("chatbot.openLabel")}" aria-expanded="false" title="${t("chatbot.name")}">
			<div id="chat-badge" class="chat-badge">1</div>${Icons.chatOpen}${Icons.chatClose}
		</button>
		<div id="chat-window" class="chat-window" role="dialog" aria-label="${t("chatbot.name")}">
			<div class="chat-header">
				<div class="chat-header-info">
					<div class="chat-avatar">${Icons.pulseWave}</div>
					<div class="chat-header-name">${t("chatbot.name")}</div>
				</div>
				<div class="chat-header-actions">
					<button class="chat-restart-btn" data-action="chat-restart" aria-label="${t("chatbot.restartLabel")}" title="${t("chatbot.restartTitle")}">${Icons.refresh}</button>
					<button class="chat-close-btn" data-action="chat-toggle" aria-label="${t("chatbot.closeLabel")}">${Icons.close}</button>
				</div>
			</div>
			<div class="chat-messages" id="chat-messages" aria-live="polite">
				<div class="chat-typing" id="chat-typing"><span></span><span></span><span></span></div>
			</div>
			<div class="chat-quick-replies" id="chat-quick-replies"></div>
			<div class="chat-input-area">
				<input type="text" id="chat-input" class="chat-input" placeholder="${t("chatbot.placeholder")}" maxlength="400" autocomplete="off" aria-label="${t("chatbot.inputLabel")}">
				<button class="chat-send-btn" data-action="chat-send" aria-label="${t("chatbot.sendLabel")}">${Icons.send}</button>
			</div>
		</div>`;
	document.body.append(root);

	// Quick reply clicks
	$("chat-quick-replies").addEventListener("click", (event) => event.target.closest(".chat-quick-btn") && void ask(event.target.textContent));
	$("chat-input").addEventListener("keydown", (event) => event.key === "Enter" && send());
};

registerActions({
	"chat-toggle": () => setOpen(!isOpen),
	"chat-restart": restart,
	"chat-send": send,
});

document.addEventListener("keydown", (event) => event.key === "Escape" && isOpen && setOpen(false));

// Move above cookie banner
for (const [name, shown] of [
	["cookie-banner:show", true],
	["cookie-banner:hide", false],
]) {
	document.addEventListener(name, () => ["chat-toggle", "chat-window"].forEach((id) => $(id)?.classList.toggle("with-banner", shown)));
}

/**
 * Start chatbot
 * @return {Promise<void>}
 */

const init = async () => {
	await initLanguage();
	buildUI();
	setTimeout(() => $("chat-badge").classList.add("visible"), BADGE_MS);
};

void init();
