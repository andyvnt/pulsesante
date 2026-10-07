import { build } from "esbuild";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { renderers } from "./render.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const DIST = join(ROOT, "dist");

const PAGES = [
	{
		view: "pages/index.html",
		route: "/",
		seo: "home",
		css: "home",
		js: "js/pages/index.js",
		schema: "organization",
	},
	{
		view: "pages/equipe.html",
		route: "/equipe/",
		seo: "equipe",
		css: "equipe",
		js: "js/pages/equipe.js",
	},
	{
		view: "pages/travaux.html",
		route: "/travaux/",
		seo: "travaux",
		css: "travaux",
		js: "js/index.js",
	},
	{
		view: "pages/mentions-legales.html",
		route: "/mentions-legales/",
		seo: "mentions-legales",
		css: "legal",
		js: "js/index.js",
	},
	{
		view: "pages/confidentialite.html",
		route: "/confidentialite/",
		seo: "confidentialite",
		css: "legal",
		js: "js/index.js",
	},
	{
		view: "articles/article-conflits-armes.html",
		route: "/article-conflits-armes/",
		seo: "article",
		css: "article",
		js: "js/index.js",
		schema: "article",
	},
	{
		view: "maintenance/index.html",
		route: "/maintenance/",
		seo: "maintenance",
		css: "maintenance",
		js: "js/pages/maintenance-page.js",
		private: true,
	},
	{
		view: "admin/login.html",
		route: "/admin/login/",
		seo: "login",
		css: "login",
		js: "js/admin/login.js",
		private: true,
	},
	{
		view: "admin/index.html",
		route: "/admin/",
		seo: "admin",
		css: "admin",
		js: "js/admin/admin.js",
		private: true,
	},
];

// Preloaded fonts
const FONT_PRELOADS = ["dm-sans", "cormorant-garamond"];
/**
 * Read source JSON
 * @param {string} path - Path under src
 * @return {Promise<any>} - Parsed data
 */

const readJSON = async (path) => JSON.parse(await readFile(join(SRC, path), "utf8"));
/**
 * Escape attribute
 * @param {unknown} value - Raw text
 * @return {string} - Safe text
 */

const escape = (value) => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");

// Clean output
await rm(DIST, { recursive: true, force: true });

// Bundle scripts and styles
const entries = [...new Set(PAGES.flatMap(({ css, js }) => [`styles/pages/${css}.css`, js].map((path) => join(SRC, path))))];
const { metafile } = await build({
	entryPoints: entries,
	outdir: join(DIST, "assets"),
	entryNames: "[ext]/[name]-[hash]",
	chunkNames: "js/chunk-[hash]",
	bundle: true,
	splitting: true,
	format: "esm",
	target: "es2022",
	minify: true,
	metafile: true,
	external: ["/assets/*"],
	loader: { ".json": "json" },
	logLevel: "warning",
});
/**
 * Hashed output URL
 * @param {string} inputPath - Path under src
 * @return {string} - Public URL
 */

const outputOf = (inputPath) => {
	const [file] = Object.entries(metafile.outputs).find(([, meta]) => meta.entryPoint === relative(ROOT, join(SRC, inputPath)));
	return `/${relative(DIST, join(ROOT, file))}`;
};

// Static assets and translations
await cp(join(SRC, "assets"), join(DIST, "assets"), { recursive: true });
await mkdir(join(DIST, "assets/i18n"), { recursive: true });
await Promise.all(
	["fr", "en", "es"].map(async (lang) => writeFile(join(DIST, `assets/i18n/${lang}.json`), JSON.stringify(await readJSON(`config/languages/${lang}.json`)))),
);

// Load data
const [seo, site, services, sectors, team, studies] = await Promise.all(
	["seo", "site", "services", "sectors", "team", "studies"].map((name) => readJSON(`config/data/${name}.json`)),
);
const render = renderers({ services, sectors, team, studies });

/**
 * Read layout partial
 * @param {string} name - Partial name
 * @return {Promise<string>} - Partial markup
 */

const template = async (name) => readFile(join(SRC, "views/layouts", `${name}.html`), "utf8");
/**
 * Expand includes and renders
 * @param {string} html - Source markup
 * @return {Promise<string>} - Final markup
 */

const expand = async (html) => {
	// Resolve includes
	const names = [...new Set([...html.matchAll(/<!--include:([\w-]+)-->/g)].map(([, name]) => name))];
	const parts = await Promise.all(names.map(async (name) => expand(await template(name))));
	const included = names.reduce((result, name, index) => result.replaceAll(`<!--include:${name}-->`, parts[index]), html);

	// Year and renders
	return included.replaceAll("{{year}}", String(new Date().getFullYear())).replace(/<!--render:(\w+)-->/g, (_, name) => render[name]());
};

/**
 * Structured data
 * @param {object} page - Page definition
 * @param {object} meta - Title and description
 * @return {object|undefined} - JSON-LD node
 */

const schemaFor = ({ schema, route }, meta) => {
	const url = seo.site + route;
	const organization = {
		"@type": "ProfessionalService",
		"@id": `${seo.site}/#organization`,
		name: "Pulse Santé",
		url: seo.site,
		description: meta.description,
		email: site.contact.email,
		areaServed: "FR",
		logo: `${seo.site}/assets/favicon.svg`,
	};
	if (schema === "organization") return organization;
	if (schema === "article")
		return {
			"@type": "Article",
			headline: meta.title,
			description: meta.description,
			mainEntityOfPage: url,
			inLanguage: "fr",
			author: { "@id": organization["@id"] },
			publisher: organization,
		};
};

/**
 * Document head
 * @param {object} page - Page definition
 * @param {object} meta - Title and description
 * @return {string} - Head markup
 */

const head = (page, meta) => {
	const title = page.seo === "home" ? meta.title : seo.titleTemplate.replace("%s", meta.title);
	const url = seo.site + page.route;
	const image = seo.site + seo.image;
	const schema = schemaFor(page, { ...meta, title });
	const jsonLd = schema ? `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", ...schema })}</script>` : "";
	return `<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escape(title)}</title>
<meta name="description" content="${escape(meta.description)}" />
<link rel="canonical" href="${url}" />
${page.private ? '<meta name="robots" content="noindex, nofollow" />' : ""}
<meta name="theme-color" content="${seo.themeColor}" />
<meta name="format-detection" content="telephone=no" />
<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg" />
<meta property="og:type" content="${page.schema === "article" ? "article" : "website"}" />
<meta property="og:site_name" content="Pulse Santé" />
<meta property="og:locale" content="${seo.locale}" />
<meta property="og:title" content="${escape(title)}" />
<meta property="og:description" content="${escape(meta.description)}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${image}" />
<meta name="twitter:card" content="summary_large_image" />
${FONT_PRELOADS.map((font) => `<link rel="preload" href="/assets/fonts/${font}.woff2" as="font" type="font/woff2" crossorigin />`).join("\n")}
<link rel="stylesheet" href="${outputOf(`styles/pages/${page.css}.css`)}" />
<script type="module" src="${outputOf(page.js)}"></script>
${jsonLd}`;
};

// Render pages
await Promise.all(
	PAGES.map(async (page) => {
		const body = await expand(await readFile(join(SRC, "views", page.view), "utf8"));
		const html = `<!doctype html>\n<html lang="fr">\n<head>\n${head(page, seo.pages[page.seo])}\n</head>\n<body>\n${body}\n</body>\n</html>\n`;
		const target = join(DIST, page.route, "index.html");
		await mkdir(dirname(target), { recursive: true });
		await writeFile(target, html);
	}),
);

// Crawl files
await mkdir(join(DIST, ".well-known"), { recursive: true });
await cp(join(SRC, "assets/security.txt"), join(DIST, ".well-known/security.txt"));
await rm(join(DIST, "assets/security.txt"));
// Indexable pages
const indexable = PAGES.filter(({ private: hidden }) => !hidden);
/**
 * Last modified date
 * @param {object} page - Page definition
 * @return {Promise<string>} - ISO date
 */

const lastModified = async ({ view }) => (await stat(join(SRC, "views", view))).mtime.toISOString().slice(0, 10);
const urls = await Promise.all(indexable.map(async (page) => `<url><loc>${seo.site}${page.route}</loc><lastmod>${await lastModified(page)}</lastmod></url>`));
await writeFile(
	join(DIST, "sitemap.xml"),
	`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`,
);
await writeFile(
	join(DIST, "robots.txt"),
	`User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /maintenance/\nDisallow: /api/\n\nSitemap: ${seo.site}/sitemap.xml\n`,
);

console.log(`Built ${PAGES.length} pages, ${(await readdir(join(DIST, "assets/js"))).length} scripts`);
