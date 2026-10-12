const INLINE_MARKDOWN = /(\*\*[\s\S]+?\*\*|\*[\s\S]+?\*|\+\+[\s\S]+?\+\+|\[\[#[\da-f]{6}\|[\s\S]+?\]\])/gi;

export const stripInlineMarkdown = (value) =>
	String(value ?? "")
		.replace(/\[\[#[\da-f]{6}\|([\s\S]*?)\]\]/gi, "$1")
		.replace(/\*\*([\s\S]+?)\*\*/g, "$1")
		.replace(/\*([\s\S]+?)\*/g, "$1")
		.replace(/\+\+([\s\S]+?)\+\+/g, "$1");

export const appendInlineMarkdown = (parent, value) => {
	const text = String(value ?? "");
	let cursor = 0;

	for (const match of text.matchAll(INLINE_MARKDOWN)) {
		const [token] = match;
		const index = match.index;
		if (index > cursor) parent.append(document.createTextNode(text.slice(cursor, index)));

		let tag;
		let content;
		let color;
		if (token.startsWith("**")) {
			tag = "strong";
			content = token.slice(2, -2);
		} else if (token.startsWith("*")) {
			tag = "em";
			content = token.slice(1, -1);
		} else if (token.startsWith("++")) {
			tag = "u";
			content = token.slice(2, -2);
		} else {
			const separator = token.indexOf("|");
			color = token.slice(2, separator).toLowerCase();
			content = token.slice(separator + 1, -2);
		}

		const element = document.createElement(tag ?? "span");
		if (color) element.style.color = color;
		appendInlineMarkdown(element, content);
		parent.append(element);
		cursor = index + token.length;
	}

	if (cursor < text.length) parent.append(document.createTextNode(text.slice(cursor)));
};
