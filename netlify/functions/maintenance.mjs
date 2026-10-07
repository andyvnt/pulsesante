import { hasSession, isTrustedRequest, json, runtime } from "./_lib/auth.mjs";

const KEY = "maintenance";
const OFF = { enabled: false, endTime: null };

/**
 * Maintenance state
 * @param {Request} req - Incoming request
 * @param {object} context - Netlify context
 * @param {ReturnType<typeof runtime>} [deps] - Injected deps
 * @return {Promise<Response>} - JSON response
 */

export default async function maintenance(req, _context, deps = runtime()) {
	const { env, store, now } = deps;

	// Public read
	if (req.method === "GET")
		return json((await store.get(KEY, { type: "json" })) ?? OFF, 200, {
			"cache-control": "public, max-age=15",
		});

	// Admin guard
	if (!hasSession(req, env.SESSION_SECRET, now)) return json({ error: "unauthorized" }, 401);
	if (!isTrustedRequest(req)) return json({ error: "forbidden" }, 403);

	// Payload check
	const { enabled, endTime } = await req.json().catch(() => ({}));
	const end = endTime ? new Date(endTime) : null;
	if (typeof enabled !== "boolean" || (end && Number.isNaN(end.getTime()))) return json({ error: "invalid" }, 400);

	// Save state
	const state = { enabled, endTime: end ? end.toISOString() : null };
	await store.setJSON(KEY, state);
	return json(state);
}

export const config = { path: "/api/maintenance", method: ["GET", "POST"] };
