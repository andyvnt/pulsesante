import { LOCK_SECONDS, MAX_FAILURES, createSessionCookie, isTrustedRequest, json, runtime, safeEqual, verifyPassword } from "./_lib/auth.mjs";

// Dummy hash for unknown emails
const DUMMY_HASH = `scrypt$${"00".repeat(16)}$${"00".repeat(64)}`;
const LOCK_MS = LOCK_SECONDS * 1000;

/**
 * Failure counter key
 * @param {{ ip?: string }} context - Netlify context
 * @return {string} - Store key
 */

const counterKey = (context) => `login-${context?.ip ?? "unknown"}`.replace(/[^\w.:-]/g, "_");

/**
 * Admin login
 * @param {Request} req - Incoming request
 * @param {{ ip?: string }} context - Netlify context
 * @param {ReturnType<typeof runtime>} [deps] - Injected deps
 * @return {Promise<Response>} - JSON response
 */

export default async function login(req, context, deps = runtime()) {
	const { env, store, now } = deps;

	// Config and origin
	if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD_HASH || !env.SESSION_SECRET) return json({ error: "unconfigured" }, 503);
	if (!isTrustedRequest(req)) return json({ error: "forbidden" }, 403);

	// Lockout check
	const key = counterKey(context);
	const record = (await store.get(key, { type: "json" })) ?? {
		count: 0,
		since: now,
	};
	const expired = now - record.since >= LOCK_MS;
	if (record.count >= MAX_FAILURES && !expired) {
		return json({ error: "locked" }, 429, {
			"retry-after": String(Math.ceil((record.since + LOCK_MS - now) / 1000)),
		});
	}

	// Credentials check
	const { email, password } = await req.json().catch(() => ({}));
	const valid = typeof email === "string" && typeof password === "string";
	const emailOk = valid && safeEqual(email.trim().toLowerCase(), env.ADMIN_EMAIL.toLowerCase());
	const passwordOk = await verifyPassword(valid ? password : "", emailOk ? env.ADMIN_PASSWORD_HASH : DUMMY_HASH);

	// Failure path
	if (!(emailOk && passwordOk)) {
		await store.setJSON(key, {
			count: expired ? 1 : record.count + 1,
			since: expired ? now : record.since,
		});
		return json({ error: "invalid" }, 401);
	}

	// Success path
	await store.delete(key);
	return json({ ok: true }, 200, {
		"set-cookie": createSessionCookie(env.SESSION_SECRET, now),
	});
}

export const config = { path: "/api/login", method: "POST" };
