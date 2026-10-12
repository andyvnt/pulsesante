import assert from "node:assert/strict";
import { test } from "node:test";
import { createSessionCookie, hashPassword, hasSession, verifyPassword } from "../netlify/functions/_lib/auth.mjs";
import login from "../netlify/functions/login.mjs";
import maintenance from "../netlify/functions/maintenance.mjs";
import studies from "../netlify/functions/studies.mjs";

const SECRET = "x".repeat(40);
const ORIGIN = "https://pulsesante.fr";
const NOW = 1_800_000_000_000;

/**
 * In-memory blob store
 * @return {{ get: Function, setJSON: Function, delete: Function }} - Fake store
 */

const memoryStore = () => {
	const data = new Map();
	return {
		get: async (key) => data.get(key) ?? null,
		setJSON: async (key, value) => void data.set(key, value),
		delete: async (key) => void data.delete(key),
	};
};

/**
 * JSON POST request
 * @param {string} url - Request path
 * @param {unknown} body - JSON payload
 * @param {Record<string, string>} [headers] - Extra headers
 * @return {Request} - Same-origin request
 */

const post = (url, body, headers = {}) =>
	new Request(`${ORIGIN}${url}`, {
		method: "POST",
		headers: { "content-type": "application/json", origin: ORIGIN, ...headers },
		body: JSON.stringify(body),
	});

/**
 * Cookie request header
 * @param {string} cookie - Set-Cookie value
 * @return {{ cookie: string }} - Request header
 */

const withCookie = (cookie) => ({ cookie: cookie.split(";")[0] });

test("password hash round trip", async () => {
	// Hash and verify
	const hash = await hashPassword("correct horse battery");
	assert.ok(await verifyPassword("correct horse battery", hash));
	assert.ok(!(await verifyPassword("wrong", hash)));
	assert.ok(!(await verifyPassword("anything", "garbage")));
});

test("session cookie validity", () => {
	// Valid cookie
	const header = withCookie(createSessionCookie(SECRET, NOW));
	const request = (headers) => new Request(ORIGIN, { headers });
	assert.ok(hasSession(request(header), SECRET, NOW));
	assert.ok(!hasSession(request(header), "y".repeat(40), NOW));
	assert.ok(!hasSession(request(header), SECRET, NOW + 9 * 3600 * 1000));
	assert.ok(!hasSession(request({ cookie: header.cookie.slice(0, -2) + "00" }), SECRET, NOW));
	assert.ok(!hasSession(request({}), SECRET, NOW));
});

test("login locks after repeated failures", async () => {
	// Configured admin
	const env = {
		ADMIN_EMAIL: "admin@pulsesante.fr",
		ADMIN_PASSWORD_HASH: await hashPassword("a-long-enough-password"),
		SESSION_SECRET: SECRET,
	};
	const deps = { env, store: memoryStore(), now: NOW };
	const ctx = { ip: "203.0.113.7" };
	const attempt = (password) => login(post("/api/login", { email: "admin@pulsesante.fr", password }), ctx, deps);

	// Five failures then lock
	for (let i = 0; i < 5; i++) assert.equal((await attempt("nope")).status, 401);
	assert.equal((await attempt("a-long-enough-password")).status, 429);

	// Lock expires
	const later = { ...deps, now: NOW + 16 * 60 * 1000 };
	const response = await login(
		post("/api/login", {
			email: "ADMIN@pulsesante.fr",
			password: "a-long-enough-password",
		}),
		ctx,
		later,
	);
	assert.equal(response.status, 200);
	assert.match(response.headers.get("set-cookie"), /HttpOnly; Secure; SameSite=Strict/);
});

test("login rejects foreign origin and missing config", async () => {
	// Missing config
	const deps = { env: {}, store: memoryStore(), now: NOW };
	assert.equal((await login(post("/api/login", {}), {}, deps)).status, 503);
	// Foreign origin
	const env = {
		ADMIN_EMAIL: "a@b.fr",
		ADMIN_PASSWORD_HASH: "x",
		SESSION_SECRET: SECRET,
	};
	const foreign = post("/api/login", {}, { origin: "https://evil.example" });
	assert.equal((await login(foreign, {}, { ...deps, env })).status, 403);
});

test("maintenance write needs a session", async () => {
	const deps = {
		env: { SESSION_SECRET: SECRET },
		store: memoryStore(),
		now: NOW,
	};
	// Anonymous write refused
	const state = { enabled: true, endTime: "2030-01-01T10:00:00.000Z" };

	assert.equal((await maintenance(post("/api/maintenance", state), {}, deps)).status, 401);
	const authed = post("/api/maintenance", state, withCookie(createSessionCookie(SECRET, NOW)));
	assert.equal((await maintenance(authed, {}, deps)).status, 200);

	// Public read
	const read = await maintenance(new Request(`${ORIGIN}/api/maintenance`), {}, deps);
	assert.deepEqual(await read.json(), state);

	// Invalid payload
	const invalid = post("/api/maintenance", { enabled: "yes" }, withCookie(createSessionCookie(SECRET, NOW)));
	assert.equal((await maintenance(invalid, {}, deps)).status, 400);
});

test("article drafts are private until published", async () => {
	const deps = {
		env: { SESSION_SECRET: SECRET },
		store: memoryStore(),
		now: NOW,
	};
	const cookie = withCookie(createSessionCookie(SECRET, NOW));
	const draft = {
		slug: "sante-mentale",
		status: "in-progress",
		title: "Santé mentale",
		domain: "Santé publique",
		desc: "Une revue de littérature.",
		intro: "Introduction de l’article.",
		sections: [
			{
				label: "Introduction",
				title: "Contexte",
				body: "Premier paragraphe.",
				boxes: [
					{ type: "definition", title: "Définition", body: "Explication." },
					{ type: "highlight", title: "À retenir", body: "Point important." },
					{ type: "stats", items: [{ value: "50 %", label: "Indicateur" }] },
					{ type: "conclusion", body: "Conclusion importante." },
				],
			},
		],
		references: [],
	};
	const planned = { ...draft, slug: "article-prevu", status: "planned" };
	const save = (articles, headers = cookie) => studies(post("/api/studies", { articles }, headers), {}, deps);

	assert.equal((await studies(new Request(`${ORIGIN}/api/studies?admin=1`), {}, deps)).status, 401);
	assert.equal((await save([draft], {})).status, 401);
	assert.equal((await save([draft, planned])).status, 200);

	const publicList = await studies(new Request(`${ORIGIN}/api/studies`), {}, deps);
	const publishedStudies = await publicList.json();
	const publicDraft = publishedStudies.find(({ slug }) => slug === draft.slug);
	assert.equal(publicDraft.status, "in-progress");
	assert.equal("intro" in publicDraft, false);
	assert.equal(publishedStudies.find(({ slug }) => slug === planned.slug).status, "planned");
	assert.equal((await studies(new Request(`${ORIGIN}/api/studies?slug=${draft.slug}`), {}, deps)).status, 404);
	assert.equal((await studies(new Request(`${ORIGIN}/api/studies?slug=${planned.slug}`), {}, deps)).status, 404);

	const published = { ...draft, status: "published" };
	assert.equal((await save([published, planned])).status, 200);
	const article = await studies(new Request(`${ORIGIN}/api/studies?slug=${draft.slug}`), {}, deps);
	assert.equal(article.status, 200);
	assert.deepEqual((await article.json()).sections[0].boxes, draft.sections[0].boxes);
});

test("article writes validate origin, publication content, and references", async () => {
	const deps = {
		env: { SESSION_SECRET: SECRET },
		store: memoryStore(),
		now: NOW,
	};
	const headers = { ...withCookie(createSessionCookie(SECRET, NOW)), origin: "https://evil.example" };
	const valid = {
		slug: "article-test",
		status: "published",
		title: "Article test",
		domain: "Santé publique",
		desc: "Résumé",
		intro: "",
		sections: [{ label: "Analyse", title: "Résultats", body: "Contenu." }],
		references: [{ title: "Source", url: "javascript:alert(1)" }],
	};
	assert.equal((await studies(post("/api/studies", { articles: [valid] }, headers), {}, deps)).status, 403);
	assert.equal(
		(await studies(post("/api/studies", { articles: [{ ...valid, sections: [] }] }, withCookie(createSessionCookie(SECRET, NOW))), {}, deps)).status,
		400,
	);
	assert.equal((await studies(post("/api/studies", { articles: [valid] }, withCookie(createSessionCookie(SECRET, NOW))), {}, deps)).status, 400);
	const invalidBox = {
		...valid,
		slug: "article-encadre-invalide",
		sections: [{ label: "Analyse", title: "Résultats", body: "Contenu.", boxes: [{ type: "stats", items: [] }] }],
	};
	assert.equal((await studies(post("/api/studies", { articles: [invalidBox] }, withCookie(createSessionCookie(SECRET, NOW))), {}, deps)).status, 400);
});

test("existing works can be updated, republished with article sections, and deleted", async () => {
	const deps = {
		env: { SESSION_SECRET: SECRET },
		store: memoryStore(),
		now: NOW,
	};
	const cookie = withCookie(createSessionCookie(SECRET, NOW));
	const adminRead = () => studies(new Request(`${ORIGIN}/api/studies?admin=1`, { headers: cookie }), {}, deps);
	const save = (articles) => studies(post("/api/studies", { articles }, cookie), {}, deps);

	const initial = await adminRead();
	assert.equal(initial.status, 200);
	const records = (await initial.json()).articles;
	const conflicts = records.find(({ slug }) => slug === "conflits");
	const unfinished = records.find(({ slug }) => slug === "risques-soignants");
	assert.equal(conflicts.builtin, true);
	assert.equal((await save(records.map((article) => (article.slug === unfinished.slug ? { ...unfinished, status: "published" } : article)))).status, 400);
	const updated = { ...conflicts, title: "Titre modifié", status: "planned" };
	assert.equal((await save(records.map((article) => (article.slug === updated.slug ? updated : article)))).status, 200);

	let publicStudies = await studies(new Request(`${ORIGIN}/api/studies`), {}, deps);
	let publicItems = await publicStudies.json();
	assert.equal(publicItems.find(({ slug }) => slug === "conflits").title, "Titre modifié");
	assert.equal(publicItems.find(({ slug }) => slug === "conflits").status, "planned");
	assert.equal((await studies(new Request(`${ORIGIN}/api/studies?slug=conflits`), {}, deps)).status, 404);

	const published = {
		...updated,
		status: "published",
		sections: [{ label: "Introduction", title: "Nouvelle version", body: "Contenu de l’article." }],
	};
	const current = (await adminRead()).json();
	const currentRecords = (await current).articles;
	assert.equal((await save(currentRecords.map((article) => (article.slug === published.slug ? published : article)))).status, 200);
	publicStudies = await studies(new Request(`${ORIGIN}/api/studies`), {}, deps);
	publicItems = await publicStudies.json();
	assert.equal(publicItems.find(({ slug }) => slug === "conflits").href, "/publication/conflits/");
	assert.equal((await studies(new Request(`${ORIGIN}/api/studies?slug=conflits`), {}, deps)).status, 200);

	const remaining = (await adminRead()).json();
	const remainingRecords = (await remaining).articles.filter(({ slug }) => slug !== "conflits");
	assert.equal((await save(remainingRecords)).status, 200);
	publicStudies = await studies(new Request(`${ORIGIN}/api/studies`), {}, deps);
	assert.equal(
		(await publicStudies.json()).some(({ slug }) => slug === "conflits"),
		false,
	);
});
