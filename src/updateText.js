import crdt from "@cocreate/crdt";
import { getAttributes } from "@cocreate/utils";
import { getStringPosition } from "@cocreate/selection";

export function insertAdjacentElement({
	domTextEditor,
	target,
	position,
	element,
	elementValue
}) {
	try {
		let remove;
		if (element && !elementValue) {
			remove = getStringPosition({
				string: domTextEditor.htmlString,
				target: element
			});
			if (!remove || (!remove.start && !remove.end))
				throw new Error("insertAdjacentElement: element not found");

			elementValue = domTextEditor.htmlString.substring(
				remove.start,
				remove.end
			);
		}

		let { start } = getStringPosition({
			string: domTextEditor.htmlString,
			target,
			position,
			value: elementValue
		});
		if (remove)
			_updateText({
				domTextEditor,
				start: remove.start,
				end: remove.end
			});
		if (remove && remove.start < start) {
			let length = remove.end - remove.start;
			_updateText({
				domTextEditor,
				value: elementValue,
				start: start - length
			});
		} else _updateText({ domTextEditor, value: elementValue, start });
	} catch (error) {
		console.error(error);
	}
}

export function removeElement({ domTextEditor, target }) {
	updateDomText({ domTextEditor, target });
}

export function setInnerText({ domTextEditor, target, value, start, end }) {
	updateDomText({ domTextEditor, target, value, pos: { start, end } });
}

export function setClass({ domTextEditor, target, value }) {
	updateDomText({ domTextEditor, target, attribute: "class", value });
}
export function removeClass({ domTextEditor, target, value }) {
	updateDomText({
		domTextEditor,
		target,
		attribute: "class",
		value,
		remove: true
	});
}

export function setStyle({ domTextEditor, target, property, value }) {
	updateDomText({
		domTextEditor,
		target,
		attribute: "style",
		property,
		value
	});
}

export function removeStyle({ domTextEditor, target, property }) {
	updateDomText({
		domTextEditor,
		target,
		attribute: "style",
		property,
		remove: true
	});
}

export function setAttribute({ domTextEditor, target, name, value }) {
	updateDomText({ domTextEditor, target, attribute: name, value });
}

export function removeAttribute({ domTextEditor, target, name }) {
	updateDomText({ domTextEditor, target, attribute: name, remove: "true" });
}

export function replaceInnerText({ domTextEditor, target, value }) {
	updateDomText({ domTextEditor, target, value });
}

export function updateDomText({
	domTextEditor,
	target,
	position,
	element,
	elementValue,
	attribute,
	value,
	property,
	pos,
	remove
}) {
	let selection = getStringPosition({
		string: domTextEditor.htmlString,
		target,
		attribute,
		property,
		value,
		remove
	});
	if (!selection) return;
	let { start, end, newValue } = selection;
	if (pos) {
		start += pos.start;
		end += pos.end;
	}
	if (start != end) _updateText({ domTextEditor, start, end });
	if ((attribute && remove != "true") || (attribute && value))
		_updateText({
			domTextEditor,
			value: ` ${attribute}="${newValue}"`,
			start
		});
	else if (value) _updateText({ domTextEditor, value, start });
}

function _updateText({ domTextEditor, value, start, end }) {
	if (domTextEditor.tagName == "HTML")
		domTextEditor = domTextEditor.ownerDocument.defaultView.frameElement;
	const { array, object, key, isCrud } = getAttributes(domTextEditor);
	crdt.updateText({
		array,
		object,
		key,
		value,
		start,
		length: end - start,
		crud: isCrud
	});
}
