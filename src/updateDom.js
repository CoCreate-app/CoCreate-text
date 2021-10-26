import {sendPosition, _dispatchInputEvent} from './index';
import {getSelection, processSelection, getElementPosition} from '@cocreate/selection';
import {domParser} from '@cocreate/utils';

export function updateDom({domTextEditor, value, start, end}) {
	if(start < 0 || start > domTextEditor.htmlString.length)
		throw new Error('position is out of range');
    
    let {element, path, position, type} = getElementPosition(domTextEditor.htmlString, start);
	if (element) {
		parseHtml(domTextEditor);
		let domEl, newEl = element, oldEl, curCaret;
		
		if(element.tagName == 'HTML') {
			domEl = domTextEditor;
			curCaret = getSelection(domEl);
			type = 'innerHTML';
		}
		else if(path) {
			domEl = domTextEditor.querySelector(path);
			oldEl = domTextEditor.oldHtml.querySelector(path);
			curCaret = getSelection(domEl);
		}
		else {
			curCaret = getSelection(domEl);
		}
		if (!value && type != 'isStartTag'){
			type = 'innerHTML';
		}
		
		if(domEl && newEl) {
			if(start != end) {
				if (start != end && domEl.tagName != 'HTML')
					domEl.parentElement.replaceChildren(...newEl.parentElement.childNodes);
				else
					domEl.replaceChildren(...newEl.childNodes);	
			}
			else if (type == 'isStartTag')
				assignAttributes(newEl, oldEl, domEl);
			else if (type == 'insertAdjacent')
				domEl.insertAdjacentHTML(position, value);
			else if (type == 'textNode')
				domEl.innerHTML = newEl.innerHTML;
			else if (type == 'innerHTML') {
				if (start != end && domEl.tagName != 'HTML')
					domEl.parentElement.replaceChildren(...newEl.parentElement.childNodes);
				else
					domEl.replaceChildren(...newEl.childNodes);
			}
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
				for(let attribute of script.attributes) {
					newScript.setAttribute(attribute.name, attribute.value);
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