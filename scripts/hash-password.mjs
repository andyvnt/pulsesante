import { hashPassword } from "../netlify/functions/_lib/auth.mjs";

// Usage: npm run hash-password -- "<password>"
const password = process.argv[2];
if (!password || password.length < 12) {
	console.error("Password of 12+ characters required");
	process.exit(1);
}

console.log(await hashPassword(password));
