import { members } from "../../config/data/team.json";
import { registerActions } from "../components/actions.js";
import { openOverlay } from "../components/overlay.js";
import "../index.js";

const MEMBERS = Object.fromEntries(members.map((member) => [member.key, member]));

/**
 * Set element text
 * @param {string} id - Element ID
 * @param {string} value - New text
 * @return {void}
 */

const setText = (id, value) => {
	document.getElementById(id).textContent = value;
};

registerActions({
	"open-member": (key) => {
		// Fill popup
		const { badge, name, role, bio, tags, avatarClass } = MEMBERS[key];
		setText("mp-badge", badge);
		setText("mp-name", name);
		setText("mp-role", role);
		setText("mp-bio", bio);
		document.getElementById("mp-avatar").className = `mp-avatar ${avatarClass}`;

		// Tag chips
		const chips = tags.map((tag) =>
			Object.assign(document.createElement("span"), {
				className: "mp-tag",
				textContent: tag,
			}),
		);
		document.getElementById("mp-tags").replaceChildren(...chips);
		openOverlay(document.getElementById("memberPopup"));
	},
});
