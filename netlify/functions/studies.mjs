import { hasSession, isTrustedRequest, json, runtime } from "./_lib/auth.mjs";
import seed from "../../src/config/data/studies.json" with { type: "json" };

const KEY = "admin-studies";
const STATUSES = new Set(["in-progress", "planned", "published"]);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BUILT_INS = new Map(seed.studies.map((study) => [study.key, study]));

const isText = (value, max) => typeof value === "string" && value.length <= max;
const IMAGE_POSITIONS = new Set(["above", "below", "left", "right"]);
const isArticleImage = (image) =>
	image &&
	typeof image === "object" &&
	!Array.isArray(image) &&
	/^\/api\/article-images\?id=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(image.src) &&
	isText(image.alt, 240) &&
	(image.caption === undefined || isText(image.caption, 300)) &&
	(image.position === undefined || IMAGE_POSITIONS.has(image.position)) &&
	(image.zoom === undefined || (Number.isFinite(image.zoom) && image.zoom >= 1 && image.zoom <= 3)) &&
	(image.focusX === undefined || (Number.isFinite(image.focusX) && image.focusX >= 0 && image.focusX <= 100)) &&
	(image.focusY === undefined || (Number.isFinite(image.focusY) && image.focusY >= 0 && image.focusY <= 100));

const validBox = (box) => {
	if (!box || typeof box !== "object" || Array.isArray(box)) return false;
	if (box.type === "stats")
		return (
			Array.isArray(box.items) &&
			box.items.length > 0 &&
			box.items.length <= 3 &&
			box.items.every((item) => item && isText(item.value, 32) && item.value.trim() && isText(item.label, 160) && item.label.trim())
		);
	if (box.type === "image") return isArticleImage(box);
	if (box.type === "conclusion") return isText(box.body, 2000) && box.body.trim();
	return ["definition", "highlight"].includes(box.type) && isText(box.title, 180) && box.title.trim() && isText(box.body, 2000) && box.body.trim();
};

const validArticle = (article) => {
	if (!article || typeof article !== "object" || Array.isArray(article)) return false;
	if (!isText(article.slug, 100) || !SLUG.test(article.slug)) return false;
	if (article.builtin ? !BUILT_INS.has(article.slug) : BUILT_INS.has(article.slug)) return false;
	if (!STATUSES.has(article.status)) return false;
	if (!isText(article.title, 180) || !article.title.trim()) return false;
	if (!isText(article.domain, 180) || !article.domain.trim()) return false;
	if (!isText(article.desc, 600) || !article.desc.trim()) return false;
	if (!isText(article.intro, 2400)) return false;
	if (!Array.isArray(article.sections) || article.sections.length > 30) return false;
	if (
		!article.sections.every(
			(section) =>
				section &&
				isText(section.label, 80) &&
				isText(section.title, 180) &&
				isText(section.body, 12000) &&
				(section.image === undefined || isArticleImage(section.image)) &&
				(section.boxes === undefined || (Array.isArray(section.boxes) && section.boxes.length <= 12 && section.boxes.every(validBox))),
		)
	)
		return false;
	if (article.heroImage !== undefined && !isArticleImage(article.heroImage)) return false;
	if (
		article.status === "published" &&
		((!article.sections.length && !(article.builtin && BUILT_INS.get(article.slug).href)) ||
			article.sections.some(({ label, title, body }) => !label.trim() || !title.trim() || !body.trim()))
	)
		return false;
	if (!Array.isArray(article.references) || article.references.length > 50) return false;
	return article.references.every((reference) => {
		if (!reference || !isText(reference.title, 300) || !isText(reference.url, 2048)) return false;
		if (!reference.url) return true;
		try {
			return new URL(reference.url).protocol === "https:";
		} catch {
			return false;
		}
	});
};

const publicStudy = ({ slug, builtin, status, title, domain, desc, href, sections }) => ({
	slug,
	builtin: Boolean(builtin),
	status,
	title,
	domain,
	desc,
	href: sections?.length ? `/publication/${slug}/` : (href ?? `/publication/${slug}/`),
	hasArticle: status === "published" && Boolean(href || sections?.length),
});

const defaultBuiltin = ({ key, done, href, domain, title, desc }) => ({
	slug: key,
	builtin: true,
	status: done ? "published" : "in-progress",
	href,
	domain,
	title,
	desc,
	intro: "",
	sections: [],
	references: [],
});

const adminArticles = (stored = {}) => {
	const overrides = new Map((stored.overrides ?? []).map((article) => [article.slug, article]));
	const deleted = new Set(stored.deleted ?? []);
	const builtins = seed.studies
		.map((study) => ({ ...defaultBuiltin(study), ...overrides.get(study.key), href: study.href }))
		.filter(({ slug }) => !deleted.has(slug));
	return [...builtins, ...(stored.articles ?? [])];
};

/**
 * List, read, and manage research articles.
 * @param {Request} req - Incoming request
 * @param {object} _context - Netlify context
 * @param {ReturnType<typeof runtime>} [deps] - Injected deps
 * @return {Promise<Response>} - JSON response
 */

export default async function studies(req, _context, deps = runtime()) {
	const { env, store, now } = deps;
	const url = new URL(req.url);
	const admin = url.searchParams.get("admin") === "1";

	if (req.method === "GET") {
		if (admin) {
			if (!hasSession(req, env.SESSION_SECRET, now)) return json({ error: "unauthorized" }, 401);
			const stored = (await store.get(KEY, { type: "json" })) ?? {};
			return json({ articles: adminArticles(stored) });
		}

		const stored = (await store.get(KEY, { type: "json" })) ?? {};
		const articles = adminArticles(stored);
		const slug = url.searchParams.get("slug");
		if (slug !== null) {
			if (!SLUG.test(slug)) return json({ error: "not_found" }, 404);
			const article = articles.find((item) => item.slug === slug && item.status === "published" && item.sections.length);
			return article ? json(article) : json({ error: "not_found" }, 404);
		}

		return json(articles.map(publicStudy), 200, { "cache-control": "no-store" });
	}

	if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, { allow: "GET, POST" });
	if (!hasSession(req, env.SESSION_SECRET, now)) return json({ error: "unauthorized" }, 401);
	if (!isTrustedRequest(req)) return json({ error: "forbidden" }, 403);

	const payload = await req.text();
	if (new TextEncoder().encode(payload).byteLength > 500_000) return json({ error: "payload_too_large" }, 413);

	let body;
	try {
		body = JSON.parse(payload);
	} catch {
		return json({ error: "invalid" }, 400);
	}

	if (!body || typeof body !== "object" || !Array.isArray(body.articles) || body.articles.length > 100 || !body.articles.every(validArticle))
		return json({ error: "invalid" }, 400);
	const slugs = body.articles.map(({ slug }) => slug);
	if (new Set(slugs).size !== slugs.length) return json({ error: "duplicate_slug" }, 400);
	const builtins = body.articles.filter(({ builtin }) => builtin);
	const builtInSlugs = new Set(builtins.map(({ slug }) => slug));
	const stored = {
		articles: body.articles.filter(({ builtin }) => !builtin),
		overrides: builtins,
		deleted: [...BUILT_INS.keys()].filter((slug) => !builtInSlugs.has(slug)),
	};
	await store.setJSON(KEY, stored);
	return json({ articles: adminArticles(stored) });
}

export const config = { path: "/api/studies", method: ["GET", "POST"] };
