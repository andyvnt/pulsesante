// Avatar icon template
const AVATAR =
	'<svg width="{size}" height="{size}" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="20" cy="13" r="6" /><path d="M6 35c0-7.7 6.3-14 14-14s14 6.3 14 14" /></svg>';
/**
 * Arrow icon
 * @param {number} size - Pixel size
 * @return {string} - SVG markup
 */

const ARROW = (size) =>
	`<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" /></svg>`;
/**
 * Clock icon
 * @param {number} size - Pixel size
 * @return {string} - SVG markup
 */

const CLOCK = (size) =>
	`<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6" /><path d="M8 5v3l2 2" /></svg>`;
/**
 * Escape HTML
 * @param {string} value - Raw text
 * @return {string} - Safe text
 */

const esc = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
/**
 * Avatar icon
 * @param {number} size - Pixel size
 * @return {string} - SVG markup
 */

const avatar = (size) => AVATAR.replaceAll("{size}", size);
/**
 * Action attributes
 * @param {string} action - Action name
 * @param {string} arg - Action argument
 * @return {string} - HTML attributes
 */

const button = (action, arg) => `role="button" tabindex="0" data-action="${action}" data-arg="${arg}"`;
/**
 * Map and join
 * @param {Array<object>} items - Source items
 * @param {(item: object) => string} fn - Item renderer
 * @return {string} - Joined markup
 */

const join = (items, fn) => items.map(fn).join("\n");

/**
 * Read-more link
 * @param {string|undefined} href - Article path
 * @return {string} - Link markup or empty
 */

const readMore = (href) => (href ? `<a href="${href}" class="etude-link">Lire l'article ${ARROW(13)}</a>` : "");

/**
 * Page renderers
 * @param {Record<string, any>} data - Config data sets
 * @return {Record<string, () => string>} - Renderers by name
 */

export const renderers = ({ services, sectors, team, studies }) => ({
	services: () =>
		join(
			services.services,
			({ key, name, tagline, icon }) => `
<div class="service-card" ${button("open-service", key)}>
	<svg class="svc-icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg>
	<h3>${esc(name)}</h3>
	<p class="tagline">${esc(tagline)}</p>
	<div class="card-arrow">Voir le détail ${ARROW(13)}</div>
</div>`,
		),
	sectors: () =>
		join(
			sectors.sectors,
			({ key, title, icon }) => `
<div class="sector-card" ${button("open-sector", key)}>
	<svg class="sector-svg" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg>
	<h4>${esc(title)}</h4>
	<div class="sector-hint">Voir les risques →</div>
</div>`,
		),
	studies: () =>
		join(
			studies.studies,
			({ done, href, domain, title, desc }) => `
<div class="etude-card${done ? "" : " en-cours"}">
	<div class="etude-badge ${done ? "badge-done" : "badge-wip"}"><span class="badge-dot"></span>${done ? "Publié" : "En cours"}</div>
	<div class="etude-domain">${esc(domain)}</div>
	<h4>${esc(title)}</h4>
	<p>${esc(desc)}</p>
	${readMore(href)}
</div>`,
		),
	works: () =>
		studies.studies
			.map(({ done, href, domain, title, desc }, index) => {
				// Optional arrow and link
				const arrow = href ? `\n\t<div class="card-arrow">${ARROW(20)}</div>` : "";
				const inner = `
	<div class="card-num">${String(index + 1).padStart(2, "0")}</div>
	<div class="card-body">
		<div class="card-meta">
			<div class="${done ? "badge-done" : "badge-wip"}"><span class="dot"></span>${done ? "Publié" : "En cours"}</div>
			<div class="card-domain">${esc(domain)}</div>
		</div>
		<h3>${esc(title)}</h3>
		<p>${esc(desc)}</p>
	</div>${arrow}`;
				return href ? `<a href="${href}" class="travail-card">${inner}\n</a>` : `<div class="travail-card wip">${inner}\n</div>`;
			})
			.join("\n"),
	team: () => {
		// Lead first
		const [lead, ...others] = [...team.members].sort((a, b) => Number(b.lead) - Number(a.lead));

		/**
		 * Tag chips
		 * @param {object} member - Team member
		 * @param {number} count - Max tags
		 * @param {string} className - Chip class
		 * @return {string} - Chips markup
		 */

		const tags = (member, count, className) =>
			member.tags
				.slice(0, count)
				.map((tag) => `<span class="${className}">${esc(tag)}</span>`)
				.join("");
		// Lead card
		const leadCard = `
<div class="tcard-lead" ${button("open-member", lead.key)}>
	<div class="tcard-avatar-lg">${avatar(38)}</div>
	<div class="tcard-lead-body">
		<div class="tcard-founder-badge">${esc(lead.badge)}</div>
		<div class="tcard-lead-name">${esc(lead.name)}</div>
		<div class="tcard-lead-role">${esc(lead.role)}</div>
		<div class="tcard-lead-tags">${tags(lead, 8, "tcard-lead-tag")}</div>
		<div class="tcard-lead-hint">${CLOCK(12)} Cliquer pour en savoir plus</div>
	</div>
</div>`;
		// Member rows
		const rows = join(
			others,
			(member) => `
	<div class="tcard-member" ${button("open-member", member.key)}>
		<div class="tcard-avatar-sm">${avatar(28)}</div>
		<div class="tcard-member-body">
			<div class="tcard-member-name">${esc(member.name)}</div>
			<div class="tcard-member-role">${esc(member.role)}</div>
			<div class="tcard-member-tags">${tags(member, 4, "tcard-member-tag")}</div>
			<div class="tcard-hint">${CLOCK(11)} Voir le profil</div>
		</div>
	</div>`,
		);
		return `${leadCard}\n<div class="tcard-row">${rows}\n</div>`;
	},
});
