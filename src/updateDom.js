import {sendPosition, _dispatchInputEvent} from './index';
import {getSelection, processSelection, getElementPosition} from '@cocreate/selection';
import {domParser} from '@cocreate/utils';

let updates = [];
export function updateDom({domTextEditor, value, start, end, html}) {
	if (!domTextEditor.htmlString)
		domTextEditor.htmlString = html;
	if(start < 0 || start > domTextEditor.htmlString.length)
		throw new Error('position is out of range');
    
    let {element, path, position, type} = getElementPosition(domTextEditor.htmlString, start, end);
		parseHtml(domTextEditor, html);
		
	let domEl, oldEl, curCaret, newEl;
	try {
		newEl = domTextEditor.newHtml.querySelector(path);
	} catch(err) {
		console.log('error', err)
	}
	if(!newEl){
		newEl = domTextEditor.cloneNode(true);
		if (html != undefined)
			newEl.innerHTML = html;
		else
			newEl.innerHTML = domTextEditor.htmlString;
		// ToDo: check prevous position and new postion if with in range use previous parent element		
		domEl = domTextEditor;

		type = 'innerHTML';
	}
	else if(element.tagName == 'HTML') {
		domEl = domTextEditor;
		type = 'innerHTML';
	}
	else if(path) {
		domEl = domTextEditor.querySelector(path);
		oldEl = domTextEditor.oldHtml.querySelector(path);
		if (!domEl || !oldEl){
		    let eid = newEl.getAttribute('eid');
			if (!domEl && eid){
				domEl = domTextEditor.querySelector(`[eid='${eid}']`);
			}
			if (!oldEl && eid){
				oldEl = domTextEditor.oldHtml.querySelector(`[eid='${eid}']`);
			}
		}
	}
	try {
		let activeElement = domEl.ownerDocument.activeElement;
		if (activeElement == domEl)
			curCaret = getSelection(activeElement);
		else if (activeElement.tagName == 'BODY')
			curCaret = getSelection(domEl);
		else
			curCaret = getSelection(activeElement);
	} catch(err){
		console.log('curCaret', err)
	}

	if (!value && type != 'isStartTag' && type != 'textNode'){
		type = 'innerHTML';
	}
	
	if(domEl && newEl) {
		let lastUpdate = updates[updates.length - 1];
		let firstUpdate = updates[0];
		let flag = false;
		let update = {
			domEl: domEl.parentElement || domEl,
			newEl: domEl.parentElement || newEl,
			start,
			end,
			path
		}
		if ((lastUpdate.end += 1) == start || (lastUpdate.start += 1) == start)
			flag = true;
		else if (start >= lastUpdate.start && start <= lastUpdate.end)
			flag = true;
		else if ((firstUpdate.end += 1) == start || (firstUpdate.start += 1) == start)
			flag = true;
		else if (start >= firstUpdate.start && start <= firstUpdate.end)
			flag = true;
		else {
			updates = [];
			updates.push(update)
		}

		if (flag && domEl.tagName == 'HTML') {
			domEl = lastChange.domEl
			update.domEl = domEl
			
		}
		else if (flag && update.domEl == domEl.parentElement || update.domEl == domEl)
			updates.push(update)

		if (domEl.nodeType == 3 && newEl.nodeType == 1){
			console.log('nodeTypes', domEl, newEl)
		}

		if(start != end && type == 'innerHTML') {
			domTextEditor.htmlString = html;
			if (domEl.tagName != 'HTML'){
				if (newEl.parentElement) {
					domEl.parentElement.replaceChildren(...newEl.parentElement.childNodes);
					console.log('parent', domEl.parentElement)
				} else {
					domEl.replaceChildren(...newEl.childNodes);
					console.log('domEl', domEl)
				}
			}
			else {
				domEl.replaceChildren(...newEl.childNodes);	
				console.log('Html tag', domEl)
			}
			// domEl = newEl;
			if (curCaret && curCaret.range) {
				curCaret.range.startContainer = domEl;
				curCaret.range.endContainer = domEl;
			}
		}
		else if (type == 'isStartTag') {
			assignAttributes(newEl, oldEl, domEl);
			console.log('isStartTag', domEl, newEl)

		}
		else if (type == 'insertAdjacent') {
			domEl.insertAdjacentHTML(position, value);
			console.log('insertAdjacent', domEl, value)
		}
		else if (type == 'textNode'){
			if(start != end)
				domTextEditor.htmlString = html;
			domEl.innerHTML = newEl.innerHTML;
			console.log('textnode', domEl.innerHTML, newEl.innerHTML)

		}
		else if (type == 'innerHTML') {
			domEl.replaceChildren(...newEl.childNodes);
			console.log('innerHtml', domEl, newEl)
		}
		domTextEditor.htmlString = html;
	}
	if(curCaret && start >= 0 && end >= 0) {
		if (curCaret.range && curCaret.start >= curCaret.range.startOffset) {
	    	let p = processSelection(domEl, value, curCaret.start, curCaret.end, start, end, curCaret.range);
	    	sendPosition(domEl);
			_dispatchInputEvent(p.element, p.value, p.start, p.end, p.prev_start, p.prev_end);
		}
	}
	
	if (newEl.tagName == 'HTML' || 'HEAD' || 'BODY' || 'SCRIPT'){
		let scripts;
		if (newEl.tagName == 'SCRIPT'){
			scripts = [newEl];
		}
		else{
			scripts = domEl.querySelectorAll('script');
		}
		for (let script of scripts) {
			let newScript = domEl.ownerDocument.createElement('script');
			for(let attribute of script.attributes) {
				newScript.setAttribute(attribute.name, attribute.value);
			}
			newScript.innerHTML = script.innerHTML;
			script.replaceWith(newScript);
		}	
	}
}

function parseHtml(domTextEditor, html) {
	var dom = domParser(html);
	if (domTextEditor.newHtml) {
		domTextEditor.oldHtml = domTextEditor.newHtml;
	} else {
		domTextEditor.oldHtml = dom;
	}
	domTextEditor.newHtml = dom;
}

function assignAttributes(newEl, oldEl, domEl) {
	if (!oldEl) return;
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