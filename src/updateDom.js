/* globals DOMParser */
import {sendPosition, _dispatchInputEvent} from './index';
import {getSelection, processSelection} from '@cocreate/selection';
import {findPosFromString, domParser} from './findElement';

export function updateDom({ domTextEditor, value, start, end}) {
	if(start < 0 || start > domTextEditor.htmlString.length)
		throw new Error('position is out of range');
    
    let {element, path, position, type} = findPosFromString(domTextEditor.htmlString, start);
	if (element) {
		parseHtml(domTextEditor);
		
		let domEl, oldEl;
		if(path) {
			domTextEditor.querySelector(path);
			oldEl = domTextEditor.oldHtml.querySelector(path);
		}
		else
			domEl = domTextEditor;
			oldEl = domTextEditor.oldHtml;
		
		let newEl = element;
		let curCaret = getSelection(domEl);
		
		if (newEl.tagName == 'HTML'){
            domTextEditor.ownerDocument.documentElement.innerHTML = newEl.outerHTML;
		}
		else{
			if (type == 'isStartTag')
				assignAttributes(newEl, oldEl, domEl);
			if (type == 'insertAdjacent')
				element.insertAdjacentHTML(position, value);
			if (type == 'textNode')
				domEl.innerHTML = newEl.innerHTML;
			if (type == 'innerHTML')
				domEl.innerHTML = newEl.innerHTML;
			if (type == 'isEndTag')
				renameTagName(newEl, domEl);
		}
		if(start && end) {
	    	let p = processSelection(domEl, value, curCaret.start, curCaret.end, start, end, curCaret.range);
	    	sendPosition(domEl);
			_dispatchInputEvent(p.element, p.value, p.start, p.end, p.prev_start, p.prev_end);
		}
		
		if (newEl.tagName == 'HTML' || 'HEAD' || 'BODY' || 'SCRIPT'){
			let scripts;
			if (newEl.tagName == 'SCRIPT'){
				scripts = [newEl]
			}
			else{
				scripts = domEl.querySelectorAll('script');
			}
			for (let script of scripts) {
				let newScript = domEl.ownerDocument.createElement('script');
				// newScript.attributes = script.attributes;
				
				for(let newElAtt of newScript.attributes) {
					try {
						newScript.setAttribute(newElAtt.name, newElAtt.value);
					}
					catch(err) {
						throw new Error("assignAttributes: " + err.message, err.name);
					}
				}
				newScript.innerHTML = script.innerHTML;
				script.replaceWith(newScript);
			}	
		}
	}
}

function parseHtml(domTextEditor) {
	var dom = domParser(domTextEditor.htmlString);
	if (domTextEditor.newHtml) {
		domTextEditor.oldHtml = domTextEditor.newHtml;
	} else {
		domTextEditor.oldHtml = dom;
	}
	domTextEditor.newHtml = dom;
}


function cloneByCreate(el) {
	let newEl = document.createElement(el.tagName);
	newEl.innerHTML = el.innerHTML;
	assignAttributes(el, newEl, newEl);
	return newEl;
}

function renameTagName(newEl, domEl) {
	let newDomEl = document.createElement(newEl.tagName);
	newDomEl.attributes = newEl.attributes;
	// assignAttributes(newEl, newDomEl, newDomEl);
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