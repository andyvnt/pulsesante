import { hasSession, json } from "./_lib/auth.mjs";

/**
 * Session status
 * @param {Request} req - Incoming request
 * @param {object} context - Netlify context
 * @param {{ env: NodeJS.ProcessEnv, now: number }} [deps] - Injected deps
 * @return {Response} - 200 or 401
 */

export default (req, context, deps = { env: process.env, now: Date.now() }) =>
	hasSession(req, deps.env.SESSION_SECRET, deps.now) ? json({ ok: true }) : json({ error: "unauthorized" }, 401);

export const config = { path: "/api/session", method: "GET" };
