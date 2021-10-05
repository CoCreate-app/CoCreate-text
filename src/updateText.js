import crud from '@cocreate/crud-client';
import crdt from '@cocreate/crdt';
import {findStartTagById, findClosingTag, getWholeElement} from './textPosition';

let space = "\u{0020}|\u{0009}";
let allAttributeName = `[a-z0-9-_]+?`;
let allStyleName = "[^:]+?";

let sps = `(${space})*?`;
let spa = `(${space})+?`;

const getRegAttribute = (attributeName) =>
	`(${spa}(?:(?:${attributeName})((?:="[^"]*?")|${space}|>)))`;
const getRegStyle = (styleName) =>
	`(?:${sps}${styleName}${sps}\:${sps}[^\;]+?${sps}\;${sps})`;
const getRegClassStyle = (styleName) => `(?:${sps}${styleName}:[^ ]+${sps})`;
const getRegClass = (className) => `(?:${sps}${className}${sps})`;

let at = getRegAttribute(allAttributeName);
let sty = getRegStyle(allStyleName);

let atSt;
let atEn;
let atVSt;
let atVEn;
// let isOmission;
// let haveClosingTag;

function removeCallback(param) {
	if(!param) return;
	let domTextEditor = param.domTextEditor;
// 	let html = domTextEditor.htmlString;
// 	domTextEditor.htmlString = removeAt(html, param.from, param.to);
// 	domTextEditor.removeCallback.call(null, param);
    if(domTextEditor.tagName =='HTML')
        domTextEditor = domTextEditor.ownerDocument.defaultView.frameElement;
    const { collection, document_id, name, isCrud } = crud.getAttr(domTextEditor);
	crdt.deleteText({
		collection,
		document_id,
		name,
		crud: isCrud,
		position: param.start,
		length: param.end - param.start,
	});

}

function addCallback(param) {
	if(!param) return;
	let domTextEditor = param.domTextEditor;
    if(domTextEditor.tagName =='HTML')
        domTextEditor = domTextEditor.ownerDocument.defaultView.frameElement;
    const { collection, document_id, name, isCrud } = crud.getAttr(domTextEditor);
// 	let html = domTextEditor.htmlString;
// 	domTextEditor.htmlString = replaceAt(html, param.position, param.value);
// 	domTextEditor.addCallback.call(null, param);
	crdt.insertText({
		collection,
		document_id,
		name,
		value: param.value,
		position: param.position,
		crud: isCrud,
	});
}

export function insertAdjacentElement({ domTextEditor, target, position, element, elementValue }) {
	let pos;
	if(!elementValue) {
		pos = getWholeElement(domTextEditor, element);
		if(!pos)
			throw new Error('insertAdjacentElement: element not found');
		elementValue = domTextEditor.htmlString.substring(pos.start, pos.end);
	}

	let {tagStPos, tagStClAfPos} = findStartTagById(domTextEditor, target);
	let {tagEnPos, tagEnClAfPos} = findClosingTag(domTextEditor, target);


	let insertPos;
	switch(position) {
		case "beforebegin":
			insertPos = tagStPos;
			break;
		case "afterbegin":
			insertPos = tagStClAfPos;
			break;
		case "beforeend":
			insertPos = tagEnPos;
			break;
		case "afterend":
			insertPos = tagEnClAfPos;
			break;
	}
	if(pos) {
		if(pos.end < insertPos)
			insertPos = insertPos - (pos.end - pos.start);
		removeCallback({domTextEditor, ...pos});
	}
	addCallback({ domTextEditor, value: elementValue, position: insertPos });
}

export function removeElement({ domTextEditor, target }) {
	let pos = getWholeElement(domTextEditor, target);
	if(!pos)
		throw new Error('removeElement: element not found');

	let insertPos;
	if(pos) {
		if(pos.end < insertPos)
			insertPos = insertPos - (pos.end - pos.start);
		removeCallback({domTextEditor, ...pos});
	}
}

export function setClass({ domTextEditor, target, classname }) {
	findAttributePos( domTextEditor, target, "class");

	if(atVEn) {
		let positions = findClassPos( domTextEditor, target, classname);
		if(positions.end)
			removeCallback({domTextEditor, ...positions});

		addCallback({ domTextEditor, position: positions.start, value: classname });
	}
	else {
		addCallback({ domTextEditor, position: atSt, value: ` class="${classname}"` });
	}

}

export function setClassStyle({ domTextEditor, target, classname, value, unit }) {
	findAttributePos(domTextEditor, target, "class");
	let classnameStr = value ? ` ${classname}:${value+unit}` : ' ' + classname;
	if(atVEn) {
		let positions = findClassPos(domTextEditor, classname);
		if(positions.end)
			removeCallback({domTextEditor, ...positions});
		if(value)
			addCallback({ domTextEditor, position: positions.start, value: classnameStr });
	}
	else if(value) {
		addCallback({ domTextEditor, position: atSt, value: ` class="${classnameStr}"` });
	}
}

function findClassPos(domTextEditor, classname, isStyle) {
	let prRegClass = isStyle ? getRegClassStyle(classname) : getRegClass(classname);

	let classStart = domTextEditor.htmlString
		.substring(atVSt, atVEn)
		.match(
			new RegExp(`(?<ourClass>${prRegClass})(?<classstyle>\:[^\"\ ]+)(\ |\")?`, "is")
		);

	if(classStart && classStart.groups.ourClass)
		return {
			start: atVSt + classStart.index,
			end: atVSt +
				classStart.index +
				classStart.groups.ourClass.length +
				classStart.groups.classstyle.length,
		};
	else
		return { start: atVEn };
}

export function setStyle({ domTextEditor, target, styleName }) {
	findAttributePos(domTextEditor, target, "style");
	if(atVSt === atVEn) return { start: atVSt, context: "value" };

	else if(atVEn) {
		let positions = findStylePos(domTextEditor, target, styleName);
		if(positions.end)
			removeCallback({domTextEditor, ...positions});

		addCallback({ domTextEditor, position: positions.start, value: styleName });
	}
	else {
		addCallback({ domTextEditor, position: atSt, value: ` style="${styleName}"` });
	}
}

function findStylePos(domTextEditor, target, style) {
	let prRegStyle = getRegStyle(style);

	let styleStart = domTextEditor.htmlString
		.substring(atVSt, atVEn)
		.match(
			new RegExp(`^(?<styleWhole>${sty})*?(?<ourStyle>${prRegStyle})`, "is")
		);
	if(styleStart && styleStart.groups.ourStyle) {
		let stlWleLen = styleStart.groups.styleWhole ?
			styleStart.groups.styleWhole.length :
			0;
		return {
			start: atVSt + stlWleLen,
			end: atVSt + stlWleLen + styleStart.groups.ourStyle.length,
		};
	}
	else
		return {
			start: atVEn,
		};
}

export function setAttribute({ domTextEditor, target, name, value }) {
	findAttributePos(domTextEditor, target, name);
	if(atEn)
		removeCallback({ domTextEditor, start: atSt, end: atEn });
	if(value)
		addCallback({ domTextEditor, position: atSt, value: ` ${name}="${value}"` });
}

export function removeAttribute({ domTextEditor, target, name }) {
	findAttributePos(domTextEditor, target, name);
	if(atEn)
		removeCallback({ domTextEditor, start: atSt, end: atEn });
}

function findAttributePos(domTextEditor, target, property) {
	let {tagStAfPos, tagStClPos} = findStartTagById(domTextEditor, target);
	if(!tagStAfPos)
		throw new Error('attribute can not be found');

	let prRegAttr = getRegAttribute(property);
	let regex = `^(?<beforeAtt>${at}*?)${prRegAttr}`;

	let attStart = domTextEditor.htmlString.substr(tagStAfPos).match(new RegExp(regex, "is"));

	if(attStart) {
		atSt = tagStAfPos + attStart.groups.beforeAtt.length;

		atVSt = atSt + 3 + property.length;
		atEn = tagStAfPos + attStart[0].length;
		atVEn = atEn - 1;
	}
	else {
		atSt = tagStClPos;
	}
}

export function setInnerText({ domTextEditor, target, value, start, end }) {
// 	target = target.getAttribute('element_id');
// 	let {tagStClAfPos} = findStartTagById(domTextEditor, target);
// 	if(!tagStClAfPos) return;

// 	start = tagStClAfPos + start;
// 	end = tagStClAfPos + end;

	if(start != end)
		removeCallback({ domTextEditor, start, end });
	if(value)
		addCallback({ domTextEditor, position: start, value });
}

export function replaceInnerText({ domTextEditor, target, value }) {
	target = target.getAttribute('element_id');
	let {tagStClAfPos} = findStartTagById(domTextEditor, target);
	if(!tagStClAfPos) return;
	let tagEnPos = findClosingTag(domTextEditor, target);
	if(!tagStClAfPos) return;
    removeCallback({ domTextEditor, start: tagStClAfPos, end: tagEnPos });
    addCallback({ domTextEditor, position: tagStClAfPos, value });
}
