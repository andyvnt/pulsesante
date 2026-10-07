import { clearSessionCookie, isTrustedRequest, json } from "./_lib/auth.mjs";

/**
 * Admin logout
 * @param {Request} req - Incoming request
 * @return {Response} - JSON response
 */

export default function logout(req) {
	return isTrustedRequest(req) ? json({ ok: true }, 200, { "set-cookie": clearSessionCookie() }) : json({ error: "forbidden" }, 403);
}

export const config = { path: "/api/logout", method: "POST" };
