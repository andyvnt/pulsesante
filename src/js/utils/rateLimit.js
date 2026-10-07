import { StorageKeys } from "../../utils/constants.js";

const MAX_ATTEMPTS = 3;
const WINDOW_MS = 5 * 60 * 1000;

/**
 * Attempt budget
 * @return {boolean} - False if exhausted
 */

export const allowAttempt = () => {
	// Recent attempts
	const now = Date.now();
	let recent = [];
	try {
		recent = JSON.parse(sessionStorage.getItem(StorageKeys.RATE_LIMITER) ?? "[]").filter((time) => now - time < WINDOW_MS);
	} catch {
		// Corrupted storage
	}

	// Budget check
	const allowed = recent.length < MAX_ATTEMPTS;
	if (allowed) recent.push(now);
	sessionStorage.setItem(StorageKeys.RATE_LIMITER, JSON.stringify(recent));
	return allowed;
};
