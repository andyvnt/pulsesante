import { hasSession, json } from "./_lib/auth.mjs";

/**
 * Default dependencies
 * @return {{ env: NodeJS.ProcessEnv, now: number }} - Runtime deps
 */

const runtime = () => ({ env: process.env, now: Date.now() });

/**
 * Session status
 * @param {Request} req - Incoming request
 * @param {object} _context - Netlify context
 * @param {{ env: NodeJS.ProcessEnv, now: number }} [deps] - Injected deps
 * @return {Response} - 200 or 401
 */

export default function session(req, _context, deps = runtime()) {
	return hasSession(req, deps.env.SESSION_SECRET, deps.now) ? json({ ok: true }) : json({ error: "unauthorized" }, 401);
}

export const config = { path: "/api/session", method: "GET" };
