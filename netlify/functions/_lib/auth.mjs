import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { getStore } from "@netlify/blobs";

const derive = promisify(scrypt);

export const COOKIE = "__Host-pulse_session";
export const SESSION_SECONDS = 8 * 3600;
export const MAX_FAILURES = 5;
export const LOCK_SECONDS = 15 * 60;

const KEY_LENGTH = 64;
const COOKIE_FLAGS = "Path=/; HttpOnly; Secure; SameSite=Strict";

/**
 * SHA-256 digest
 * @param {string} value - Input text
 * @return {Buffer} - Fixed-size hash
 */

const digest = (value) => createHash("sha256").update(value).digest();

/**
 * Safe string equality
 * @param {string} a - First value
 * @param {string} b - Second value
 * @return {boolean} - True if equal
 */

export const safeEqual = (a, b) => timingSafeEqual(digest(a), digest(b));

/**
 * Hash a password
 * @param {string} password - Plain password
 * @return {Promise<string>} - scrypt$salt$hash
 */

export const hashPassword = async (password) => {
	// Random salt
	const salt = randomBytes(16);
	const hash = await derive(password, salt, KEY_LENGTH);
	return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
};

/**
 * Check a password
 * @param {string} password - Plain password
 * @param {string} stored - Stored hash
 * @return {Promise<boolean>} - True if valid
 */

export const verifyPassword = async (password, stored) => {
	// Parse stored hash
	const [scheme, salt, hash] = String(stored).split("$");
	if (scheme !== "scrypt" || !salt || !hash) return false;

	// Constant-time compare
	const expected = Buffer.from(hash, "hex");
	const actual = await derive(password, Buffer.from(salt, "hex"), expected.length);
	return timingSafeEqual(actual, expected);
};

/**
 * Session signature
 * @param {string} secret - Signing secret
 * @param {number|string} expires - Expiry seconds
 * @return {string} - Hex HMAC
 */

const sign = (secret, expires) => createHmac("sha256", secret).update(`session.${expires}`).digest("hex");

/**
 * Create session cookie
 * @param {string} secret - Signing secret
 * @param {number} [now] - Current ms
 * @return {string} - Set-Cookie value
 */

export const createSessionCookie = (secret, now = Date.now()) => {
	const expires = Math.floor(now / 1000) + SESSION_SECONDS;
	return `${COOKIE}=${expires}.${sign(secret, expires)}; Max-Age=${SESSION_SECONDS}; ${COOKIE_FLAGS}`;
};

/**
 * Clear session cookie
 * @return {string} - Set-Cookie value
 */

export const clearSessionCookie = () => `${COOKIE}=; Max-Age=0; ${COOKIE_FLAGS}`;

/**
 * Check session cookie
 * @param {Request} req - Incoming request
 * @param {string} secret - Signing secret
 * @param {number} [now] - Current ms
 * @return {boolean} - True if valid
 */

export const hasSession = (req, secret, now = Date.now()) => {
	if (!secret) return false;

	// Read cookie value
	const raw = req.headers.get("cookie") ?? "";
	const match = raw.split(/;\s*/).find((part) => part.startsWith(`${COOKIE}=`));
	const [expires, signature] = (match?.slice(COOKIE.length + 1) ?? "").split(".");

	// Expiry and signature
	if (!expires || !signature || Number(expires) * 1000 < now) return false;
	return safeEqual(signature, sign(secret, expires));
};

/**
 * Same-origin JSON request
 * @param {Request} req - Incoming request
 * @return {boolean} - True if trusted
 */

export const isTrustedRequest = (req) => {
	const origin = req.headers.get("origin");
	const sameOrigin = !origin || origin === new URL(req.url).origin;
	return sameOrigin && (req.headers.get("content-type") ?? "").startsWith("application/json");
};

/**
 * JSON response
 * @param {unknown} body - Payload
 * @param {number} [status] - HTTP status
 * @param {Record<string, string>} [headers] - Extra headers
 * @return {Response} - Uncached response
 */

export const json = (body, status = 200, headers = {}) =>
	new Response(JSON.stringify(body), {
		status,
		headers: {
			"content-type": "application/json",
			"cache-control": "no-store",
			...headers,
		},
	});

/**
 * Runtime dependencies
 * @return {{ env: NodeJS.ProcessEnv, store: object, now: number }} - Default deps
 */

export const runtime = () => ({
	env: process.env,
	store: getStore("pulse"),
	now: Date.now(),
});
