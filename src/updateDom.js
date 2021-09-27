/* globals DOMParser */
import {getSelections, processSelections} from './selections';
import {findElByPos} from './textPosition';

export function updateDom({ domTextEditor, value, start, end}) {
	if(start < 0 || start > domTextEditor.htmlString.length)
		throw new Error('position is out of range');
    let {target, tagStClAfPos} = findElByPos(domTextEditor, start);
    if (!target || !tagStClAfPos) {
        rebuildByDocument(domTextEditor);
    } else {
        let elStart = start - tagStClAfPos;
    	let elEnd = end - tagStClAfPos;
        rebuildByElement(domTextEditor, target, value, elStart, elEnd);
    }
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
