import assert from "node:assert/strict";
import { test } from "node:test";
import { createSessionCookie, hashPassword, hasSession, verifyPassword } from "../netlify/functions/_lib/auth.mjs";
import login from "../netlify/functions/login.mjs";
import maintenance from "../netlify/functions/maintenance.mjs";

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
