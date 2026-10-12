import { randomUUID } from "node:crypto";
import { hasSession, json, runtime } from "./_lib/auth.mjs";

const PREFIX = "article-image-";
const MAX_SIZE = 5_000_000;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const trustedUpload = (req) => {
	const origin = req.headers.get("origin");
	return (!origin || origin === new URL(req.url).origin) && (req.headers.get("content-type") ?? "").startsWith("multipart/form-data");
};

const matchesType = (bytes, type) => {
	if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
	if (type === "image/png") return bytes.subarray(0, 8).join(",") === "137,80,78,71,13,10,26,10";
	return type === "image/webp" && bytes.subarray(0, 4).toString() === "82,73,70,70" && bytes.subarray(8, 12).toString() === "87,69,66,80";
};

export default async function articleImages(req, _context, deps = runtime()) {
	const { env, store, now } = deps;
	const url = new URL(req.url);

	if (req.method === "GET") {
		const id = url.searchParams.get("id");
		if (!id || !UUID.test(id)) return json({ error: "not_found" }, 404);
		const key = `${PREFIX}${id}`;
		const entry = await store.getMetadata(key, { consistency: "strong" });
		if (!entry) return json({ error: "not_found" }, 404);
		const contentType = entry.metadata.contentType;
		if (!IMAGE_TYPES.has(contentType)) return json({ error: "not_found" }, 404);
		const image = await store.get(key, { type: "arrayBuffer", consistency: "strong" });
		return new Response(image, {
			headers: {
				"content-type": contentType,
				"cache-control": "public, max-age=31536000, immutable",
				"x-content-type-options": "nosniff",
			},
		});
	}

	if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, { allow: "GET, POST" });
	if (!hasSession(req, env.SESSION_SECRET, now)) return json({ error: "unauthorized" }, 401);
	if (!trustedUpload(req)) return json({ error: "forbidden" }, 403);

	const length = Number(req.headers.get("content-length"));
	if (Number.isFinite(length) && length > MAX_SIZE + 100_000) return json({ error: "payload_too_large" }, 413);
	let form;
	try {
		form = await req.formData();
	} catch {
		return json({ error: "invalid" }, 400);
	}
	const file = form.get("file");
	if (!(file instanceof File) || !IMAGE_TYPES.has(file.type)) return json({ error: "unsupported_image" }, 400);
	if (!file.size || file.size > MAX_SIZE) return json({ error: "payload_too_large" }, 413);

	const bytes = new Uint8Array(await file.arrayBuffer());
	if (!matchesType(bytes, file.type)) return json({ error: "invalid_image" }, 400);

	const id = randomUUID();
	await store.set(`${PREFIX}${id}`, bytes.buffer, { metadata: { contentType: file.type } });
	return json({ src: `/api/article-images?id=${id}` });
}

export const config = { path: "/api/article-images", method: ["GET", "POST"] };
