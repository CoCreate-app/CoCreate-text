/*global DOMParser*/
import crud from '@cocreate/crud-client';
import crdt from '@cocreate/crdt';
import {getSelections, processSelections} from './index';

let space = "\u{0020}|\u{0009}";
let allAttributeName = `[a-z0-9-_]+?`;
let allStyleName = "[^:]+?";

let sps = `(${space})*?`;
let spa = `(${space})+?`;
let tgs = `(?:<(?<tagName>[a-z0-9]+?))`;
let getEndTag = tagName => `(?:<(?<isClosing>${sps}\/${sps})?${tagName}${sps})`;

const getRegAttribute = (attributeName) =>
	`(${spa}(?:(?:${attributeName})((?:="[^"]*?")|${space}|>)))`;
const getRegStyle = (styleName) =>
	`(?:${sps}${styleName}${sps}\:${sps}[^\;]+?${sps}\;${sps})`;
const getRegClassStyle = (styleName) => `(?:${sps}${styleName}:[^ ]+${sps})`;
const getRegClass = (className) => `(?:${sps}${className}${sps})`;

let at = getRegAttribute(allAttributeName);
let the = `${sps}(?<tagSlash>\/)?${sps}>`;
let sty = getRegStyle(allStyleName);

const idSearch = 'element_id=';

let target;
let tagName;
let tagStPos;
let tagStAfPos;
let tagStClPos;
let tagStClAfPos;
let tagEnPos;
let tagEnClAfPos;
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

// function replaceAt(html, index, replacement) {
// 	return html.substr(0, index) + replacement + html.substr(index);
// }

// function removeAt(html, index, to) {
// 	return html.substr(0, index) + html.substr(to);
// }

export function getDomPosition({ domTextEditor, target, start, end }) {
	target = target.getAttribute('element_id');
	if(findStartTagById(domTextEditor, target))
		findClosingTag(domTextEditor, target);
	else return;

	start = tagStClAfPos + start;
	end = tagStClAfPos + end;
	return {start, end};
}

function findStartTagById(domTextEditor, target) {
	let sch = `(?:${sps}element_id\=\"${target}\"${sps})`;
	let reg = `(?<tagWhole>${tgs}${at}*?${sch}${at}*?${the})`;
	let tagStart = domTextEditor.htmlString.match(new RegExp(reg, "is"));

	if(!tagStart)
		throw new Error('element is not valid or can not be found');

	tagName = tagStart.groups.tagName.toUpperCase();

	tagStPos = tagStart.index;
	tagStAfPos = tagStart.index + tagName.length + 1;
	tagStClPos = tagStart.index + tagStart.groups.tagWhole.length - 1 - (tagStart.groups.tagSlash ? 1 : 0);
	// haveClosingTag = !tagStart.groups.tagSlash;
	tagStClAfPos = tagStart.index + tagStart.groups.tagWhole.length;
// 	tagNameEnd = tagStAfPos + tagName.length;
	// if it's like <img />
	if(tagStart.groups.tagSlash) {
		tagEnPos = tagStClPos;
		tagEnClAfPos = tagStClAfPos;
		// isOmission = true; // if the tag doesn't have closing counterpart
	}
	return true;
}

function getWholeElement(domTextEditor, target) {
	if(findStartTagById(domTextEditor, target)) {
		findClosingTag(domTextEditor, target);
		return { start: tagStPos, end: tagEnClAfPos || tagStClAfPos };
	}
	else
		return false;
}


function findClosingTag(domTextEditor, target) {
	let match = domTextEditor.htmlString.substr(tagStClAfPos)
		.matchAll(new RegExp(`(?<tagWhole>${getEndTag(tagName)}${at}*?${the})`, 'gi'));

	if(!match) throw new Error('can not find any closing tag');

	let nest = 0;

	for(let i of match) {
		if(i.groups.isClosing) {
			if(!nest) {
				tagEnPos = tagStClAfPos + i.index;
				tagEnClAfPos = tagStClAfPos + i.index + i[0].length;
				return true;
			}
			else
				nest--;
		}
		else
			nest++;
	}
	throw new Error('closing tag and openning tag order does not match');
}

function insertAdjacentElement({ domTextEditor, target, position, element, elementValue }) {
	let pos;
	if(!elementValue) {
		pos = getWholeElement(domTextEditor, element);
		if(!pos)
			throw new Error('insertAdjacentElement: element not found');
		elementValue = domTextEditor.htmlString.substring(pos.start, pos.end);
	}

	findStartTagById(domTextEditor, target);

	let insertPos;
	switch(position) {
		case "beforebegin":
			insertPos = tagStPos;
			break;
		case "afterbegin":
			insertPos = tagStClAfPos;
			break;
		case "beforeend":
			findClosingTag(domTextEditor, target);
			insertPos = tagEnPos;
			break;
		case "afterend":
			findClosingTag(domTextEditor, target);
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

function removeElement({ domTextEditor, target }) {
	let pos = getWholeElement(domTextEditor, target);
	if(!pos)
		throw new Error('removeElement: element not found');

	findStartTagById(domTextEditor, target);

	let insertPos;
	if(pos) {
		if(pos.end < insertPos)
			insertPos = insertPos - (pos.end - pos.start);
		removeCallback({domTextEditor, ...pos});
	}
}

function setClass({ domTextEditor, target, classname }) {
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

function setClassStyle({ domTextEditor, target, classname, value, unit }) {
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

function setStyle({ domTextEditor, target, styleName }) {
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

function setAttribute({ domTextEditor, target, name, value }) {
	findAttributePos(domTextEditor, target, name);
	if(atEn)
		removeCallback({ domTextEditor, start: atSt, end: atEn });
	if(value)
		addCallback({ domTextEditor, position: atSt, value: ` ${name}="${value}"` });
}

function removeAttribute({ domTextEditor, target, name }) {
	findAttributePos(domTextEditor, target, name);
	if(atEn)
		removeCallback({ domTextEditor, start: atSt, end: atEn });
}

function findAttributePos(domTextEditor, target, property) {
	if(!findStartTagById(domTextEditor, target))
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
	target = target.getAttribute('element_id');
	if(findStartTagById(domTextEditor, target))
		findClosingTag(domTextEditor, target);
	else return;

	start = tagStClAfPos + start;
	end = tagStClAfPos + end;

	if(start != end)
		removeCallback({ domTextEditor, start, end });
	if(value)
		addCallback({ domTextEditor, position: start, value });
}

export function replaceInnerText({ domTextEditor, target, value }) {
	target = target.getAttribute('element_id');
	if(findStartTagById(domTextEditor, target))
		findClosingTag(domTextEditor, target);
	else return;

  removeCallback({ domTextEditor, start: tagStClAfPos, end: tagEnPos });
  addCallback({ domTextEditor, position: tagStClAfPos, value });
}

export function changeDom({ domTextEditor, value, start, end}) {
	if(start < 0 || start > domTextEditor.htmlString.length)
		throw new Error('position is out of range');
	let elStart = start - tagStClAfPos;
	let elEnd = end - tagStClAfPos;
	findElByPos(domTextEditor, start) ? rebuildByElement(domTextEditor, target, value, elStart, elEnd) : rebuildByDocument(domTextEditor);
}

function findElByPos(domTextEditor, pos) {
	let pos1 = pos - idSearch.length;
	let pos2 = pos + idSearch.length;

	pos1 = domTextEditor.htmlString.indexOf(idSearch, pos1 + idSearch.length);
	if(pos1 !== -1 && isPosOnEl(domTextEditor, pos1, pos))
		return true;

	while(true) {
		pos2 = domTextEditor.htmlString.lastIndexOf(idSearch, pos2 - idSearch.length);

		if(pos2 !== -1) {
			if(isPosOnEl(domTextEditor, pos2, pos))
				return true;
		}
		else return false;
	}

}

function isPosOnEl(domTextEditor, elementIdPos, pos) {
	target = getId(domTextEditor, elementIdPos + idSearch.length);

	if(!findStartTagById(domTextEditor, target))
		return false;

	findClosingTag(domTextEditor, target);
	let tagStartPos = tagStPos;
	let tagEndPos = tagEnClAfPos || tagStClAfPos;

	if(pos > tagStartPos && pos < tagEndPos) {
		return true;
	}
}

function getId(domTextEditor, pos) {
	let attWrapper = domTextEditor.htmlString[pos];
	let endWrapper = domTextEditor.htmlString.indexOf(attWrapper, pos + 1);
	return domTextEditor.htmlString.substring(pos + 1, endWrapper);
}


function rebuildByElement(domTextEditor, target, value, start, end) {
	parseHtml(domTextEditor);
	let domEl = domTextEditor.querySelector(`[element_id="${target}"]`);
	let newEl = domTextEditor.newHtml.querySelector(`[element_id="${target}"]`);
	let oldEl = domTextEditor.oldHtml.querySelector(`[element_id="${target}"]`);
	rebuildDom({domTextEditor, domEl, newEl, oldEl, value, start, end});
}

function rebuildByDocument(domTextEditor) {
	parseHtml(domTextEditor);
	let domEl = domTextEditor;
	let newEl = domTextEditor.newHtml.documentElement || domTextEditor.newHtml.childNodes;
	let oldEl = domTextEditor.oldHtml.documentElement || domTextEditor.oldHtml.childNodes;
	
	if (domTextEditor.newHtml.documentElement) {
		rebuildDom({domTextEditor, domEl, newEl, oldEl});
	}
	else
		rebuildDom({domTextEditor, domEl, newEl, oldEl});
}

function parseHtml(domTextEditor) {
	var dom = parseAll(domTextEditor);
	if (domTextEditor.newHtml) {
		domTextEditor.oldHtml = domTextEditor.newHtml;
	} else {
		domTextEditor.oldHtml = dom;
	}
	domTextEditor.newHtml = dom;
}

function parseAll(domTextEditor) {
    let str = domTextEditor.htmlString;
	let mainTag;
	try {
		mainTag = str.match(/\<(?<tag>[a-z0-9]+)(.*?)?\>/).groups.tag;
	} 
	finally {
		let doc = new DOMParser().parseFromString(str, "text/html");
		switch(mainTag) {
			case 'html':
				return doc.documentElement;
			case 'head':
				return doc.head;
			case 'body':
				return doc.body;
			default:
				if(doc.head.children.length) return doc.head.children;
				else return doc.body;
		}
	}
}

function rebuildDom({domTextEditor, domEl, newEl, oldEl, value, start, end}) {
    let curCaret = getSelections(domEl);
    // try{
		if(domEl.tagName && newEl.nodeType == 1) {
			if(newEl.tagName !== domEl.tagName) {
				renameTagName(newEl, domEl);
				return;
			}	
			if(domEl.tagName === "SCRIPT" && newEl.src !== domEl.src) {
				domEl.replaceWith(cloneByCreate(newEl));
				return;
			}
			if(oldEl) {
				assignAttributes(newEl, oldEl, domEl);
			}
		}
	
		const domElChildren = domEl.childNodes;
		let newElChildren;
		if(newEl.nodeType == 1) {
			newElChildren = Array.from(newEl.childNodes);
		} else {newElChildren = newEl;}
	
		if(newEl.tagName === "HEAD" && !newElChildren.length) return;
	
		let index = 0, len = newElChildren.length;
		for(; index < len; index++) {
			let textChild = newElChildren[index],
				domChild = domElChildren[index];
			
			// if (domChild.nodeName === '#comment') continue;
			let newElIsText = isTextOrEl(textChild);
	
			if(!domChild) {
				if(newElIsText === true)
					domEl.insertAdjacentText('beforeend', textChild.data);
				else if(newElIsText === false)
					insertAdajcentClone(domEl, textChild, 'beforeend');
				else continue;
			}
			else {
				let domElIsText = isTextOrEl(domChild);
				if(domElIsText === undefined) continue;
				// if (domEl.domText == true) continue;
	
				if(newElIsText) {
					if(domElIsText) {
						if(textChild.data.trim() !== domChild.data.trim())
							// if (domEl.domText == true) continue;
							domChild.data = textChild.data;
					}
					else {
						domChild.before(document.createTextNode(textChild.data));
						let domElId = domChild.getAttribute('element_id');
	
						if(domElId) {
							let elIndex = elIndexOf(domElId, domEl.childNodes);
							if(elIndex === -1) {
								domChild.remove();
	
								mergeTextNode(domElChildren[index], domElChildren[index - 1]);
								index--;
								continue;
							}
							else if(domElChildren[elIndex] && domElChildren[elIndex] !== domChild)
								domElChildren[elIndex].before(domChild);
						}
					}
				}
				else {
					if(domElIsText) {
						textInsertAdajcentClone(domChild, textChild, 'beforebegin');
						domChild.remove();
					}
					else {
						if (domChild.nodeName === '#comment') continue;
						let domElId = domChild.getAttribute('element_id');
						let newElId = textChild.getAttribute('element_id');
	
						if(newElId && domElId !== newElId) {
							let elIndex = elIndexOf(newElId, domEl.childNodes);
							if (!elIndex) continue;
							if(elIndex === -1)
								insertAdajcentClone(domChild, textChild, 'beforebegin');
							else
								domChild.insertAdjacentElement('beforebegin', domEl.childNodes[elIndex]);
	
							// new element has been added we should process the new element again at index
							domChild = domElChildren[index];
							domElId = domChild.getAttribute('element_id');
							if(domElId) {
								elIndex = elIndexOf(domElId, domEl.childNodes);
	
								if(elIndex === -1) {
									domChild.remove();
									mergeTextNode(domElChildren[index], domElChildren[index - 1]);
									index--;
									continue;
								}
								else if(domElChildren[elIndex] && domElChildren[elIndex] !== domChild)
									domElChildren[elIndex].before(domChild);
							}
						}
						else {
						  //  processSelections(domEl, value, curCaret.start, curCaret.end, start, end);
							rebuildDom({ domTextEditor, domEl: domChild, newEl: textChild });
						}
					}
				}
			}
		}
		if(start && end)
	    	processSelections(domEl, value, curCaret.start, curCaret.end, start, end, curCaret.range);
		// remove rest of the child in the element
		while(domElChildren[index]) {
			domElChildren[index].remove();
		}
	// }
	// catch(err) {
	// 	throw new Error("domText failed to apply the change " + err.message, err.name);
	// }
}

function cloneByCreate(el) {
	let newEl = document.createElement(el.tagName);
	newEl.innerHTML = el.innerHTML;
	assignAttributes(el, newEl, newEl);
	return newEl;
}

function insertAdajcentClone(target, element, position) {
	let cloned = element.cloneNode(true);
	if(cloned.tagName === "SCRIPT")
		cloned = cloneByCreate(cloned);
	cloned.querySelectorAll('script').forEach(el => {
		el.replaceWith(cloneByCreate(el));
	});

	target.insertAdjacentElement(position, cloned);
}

function textInsertAdajcentClone(target, element, position) {
	if (element.nodeName === '#comment') return;
	let func = position === "beforebegin" ? target.before : target.after;
	let cloned = element.cloneNode(true);
	if(cloned.tagName === "SCRIPT")
		cloned = cloneByCreate(cloned);
	if (cloned.nodeName === '#comment') return;
	cloned.querySelectorAll('script').forEach(el => {
		el.replaceWith(cloneByCreate(el));
	});
	func.call(target, cloned);
}

function mergeTextNode(textNode1, textNode2) {
	if(isTextOrEl(textNode1) === true && textNode2 && isTextOrEl(textNode2) === true) {
		textNode2.data += textNode1.data;
		textNode1.remove();
	}
}

function isTextOrEl(el) {
	if(el.constructor.name === 'Text')
		return true;
	else if(el.constructor.name.indexOf('Element'));
		return false;
}

function elIndexOf(id, elList) {
	for(let i = 0; i < elList.length; i++) {
		if (elList[i].nodeName === '#comment') return;
		if(isTextOrEl(elList[i]) === false && elList[i].getAttribute('element_id') == id)
			return i;
	}
	return -1;
}


function renameTagName(newEl, domEl) {
	let newDomEl = document.createElement(newEl.tagName);
	assignAttributes(newEl, newDomEl, newDomEl);
	newDomEl.replaceChildren(...newEl.childNodes);
	domEl.replaceWith(newDomEl);
}

// overwrite except element_id
function assignAttributes(newEl, oldEl, domEl) {
	for(let newElAtt of newEl.attributes) {
		if(!oldEl.attributes[newElAtt.name] || oldEl.attributes[newElAtt.name].value !== newElAtt.value)
			try {
				domEl.setAttribute(newElAtt.name, newElAtt.value);
			}
		catch(err) {
			throw new Error("assignAttributes: " + err.message, err.name);
		}
	}

	if(newEl.attributes.length !== oldEl.attributes.length) {
		for(let i = 0, len = oldEl.attributes.length; i < len; i++) {
			let oldElAtt = oldEl.attributes[i];
			if(!newEl.attributes[oldElAtt.name]) {
				domEl.removeAttribute(oldElAtt.name);
				i--, len--;
			}

		}

	}
}

export {insertAdjacentElement, removeElement, setAttribute, removeAttribute, setClass, setStyle, setClassStyle};
