/*global CoCreate, DOMParser, CustomEvent, navigator*/

import observer from '@cocreate/observer';
import crud from '@cocreate/crud-client';
import crdt from '@cocreate/crdt';
import {updateDom} from './updateDom';
import {insertAdjacentElement, removeElement, setInnerText, setAttribute, removeAttribute, setClass, setStyle, setClassStyle, replaceInnerText} from './updateText';
import {getSelection, processSelection} from '@cocreate/selection';
import './saveDomText';

let eventObj;
let selector = `[collection][document_id][name]`;
let selectors = `input${selector}, textarea${selector}, [contenteditable]${selector}:not([contenteditable='false'])`;

function init() {
    let elements = document.querySelectorAll(selectors);
    initElements(elements);
    _crdtUpdateListener();
}

function initElements (elements) {
    for(let element of elements)
        initElement(element);
}

function initElement (element) {
    const { collection, document_id, name, isRealtime, isCrdt } = crud.getAttr(element);
    if(document_id == "pending") return;
    if(isCrdt == "false" || isRealtime == "false") return;
    if(!crud.checkAttrValue(collection) && !crud.checkAttrValue(document_id)) return;
    if(element.tagName === "INPUT" && ["text", "email", "tel", "url"].includes(element.type) || element.tagName === "TEXTAREA" || element.hasAttribute('contenteditable')) {
        if(!collection || !document_id || !name) return;

        if (!isCrdt) {
            if (element.tagName == 'IFRAME')
                _addEventListeners(element.contentDocument.documentElement);
            else 
            _addEventListeners(element);
        }   
        element.setAttribute('crdt', 'true');
        element.crdt = {init: true};
        crdt.init({ collection, document_id, name });
        // element.crdt = { collection, document_id, name };
    }
}

export function _addEventListeners (element) {
    element.addEventListener('click', _click);
    element.addEventListener('blur', _blur);
    element.addEventListener('keyup', _keyup);
    element.addEventListener('cut', _cut);
    element.addEventListener('paste', _paste);
    element.addEventListener('keydown', _keydown);
    element.addEventListener('keypress', _keypress);
}

function _click (event) {
    let element = event.currentTarget;
    sendPosition(element);
}

function _blur (event) {
    let element = event.currentTarget;
    const { collection, document_id, name } = crud.getAttr(element);
    let start = null;
    let end = null;
    crdt.sendPosition({collection, document_id, name, start, end});
}

function _keyup (event) {
    let element = event.currentTarget;
    sendPosition(element);
}

function _cut (event) {
    let element = event.currentTarget;
    const { start, end, range } = getSelection(element);
    const selection = document.getSelection();
    console.log(selection.toString());
    if (event.clipboardData) {
        event.clipboardData.setData('text/plain', selection.toString());
    }
    else {
        navigator.clipboard.writeText(selection.toString()).then(function() {
          /* clipboard successfully set */
        }, function() {
          /* clipboard write failed */
        });
    }
    if(start != end) {
        deleteText(element, start, end, range);
    }
    event.preventDefault();
}

function _paste (event) {
    let element = event.currentTarget;
    let value = event.clipboardData.getData('Text');
    const { start, end, range } = getSelection(element);
    if(start != end) {
        deleteText(element, start, end, range);
    }
    value = addElementId(value);
    insertText(element, value, start, range);
    event.preventDefault();
}

function _keydown (event) {
    if(event.stopCCText) return;
    let element = event.currentTarget;
    const { start, end, range } = getSelection(element);
    if(event.key == "Backspace" || event.key == "Tab" || event.key == "Enter") {
        eventObj = event;
        if(start != end) {
            deleteText(element, start, end, range);
        }
        if(event.key == "Backspace" && start == end) {
            deleteText(element, start - 1, end, range);
        }
        if(event.key == 'Tab') {
            insertText(element, "\t", start, range);
        }
        if(event.key == "Enter") {
            insertText(element, "\n", start, range);
        }
        event.preventDefault();
    }
}

function _keypress (event) {
    if(event.stopCCText) return;
    let element = event.currentTarget;
    let { start, end, range } = getSelection(element);
    if(start != end) {
        deleteText(element, start, end, range);
    }
    eventObj = event;
    insertText(element, event.key, start, range);
    event.preventDefault();
}

function _removeEventListeners (element) {
    element.removeEventListener('click', _click);
    element.removeEventListener('blur', _blur);
    element.removeEventListener('keyup', _keyup);
    element.removeEventListener('cut', _cut);
    element.removeEventListener('paste', _paste);
    element.removeEventListener('keydown', _keydown);
    element.removeEventListener('keypress', _keypress);
}


export function sendPosition (element) {
    if (!element) return;
    const { start, end } = getSelection(element);
    if (element.tagName == 'HTML' && !element.hasAttribute('collection') || !element.hasAttribute('collection')) 
        element = element.ownerDocument.defaultView.frameElement;
    const { collection, document_id, name } = crud.getAttr(element);
    crdt.sendPosition({ collection, document_id, name, start, end });
}

function deleteText (element, start, end, range) {
    if (element.tagName == 'HTML' && !element.hasAttribute('collection')) 
        element = element.ownerDocument.defaultView.frameElement;
    const { collection, document_id, name, isCrud, isSave } = crud.getAttr(element);
    if(isSave == "false") return;
    let length = end - start;
    if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
        crdt.deleteText({ collection, document_id, name, position: start, length, crud: isCrud });
    } else {
        let startEl =  range.startContainer.parentElement;
        let endEl =  range.endContainer.parentElement;
        if (startEl != endEl) {
        //     target = range.commonAncestorContainer;
        //     // value = target.innerHTML;
        //     // replaceInnerText(domTextEditor, target, value)
        }
        crdt.deleteText({ collection, document_id, name, position: start, length, crud: isCrud });
    }
}

function insertText (element, value, start, range) {
    if (element.tagName == 'HTML' && !element.hasAttribute('collection')) 
        element = element.ownerDocument.defaultView.frameElement;
    const { collection, document_id, name, isCrud, isSave } = crud.getAttr(element);
    if(isSave == "false") return;
    if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
        crdt.insertText({ collection, document_id, name, value, position: start, crud: isCrud });
    } else {
        let startEl =  range.startContainer.parentElement;
        let endEl =  range.endContainer.parentElement;
        if (startEl != endEl) {
            // target = range.commonAncestorContainer;
            // value = target.innerHTML;
            // replaceInnerText(domTextEditor, target, value)
        }
        crdt.insertText({ collection, document_id, name, value, position: start, crud: isCrud });
    }
}

function _crdtUpdateListener () {
    window.addEventListener('cocreate-crdt-update', function(event) {
        var info = event.detail;
        let collection = info['collection'];
        let document_id = info['document_id'];
        let name = info['name'];
        let selectors = `[collection='${collection}'][document_id='${document_id}'][name='${name}']`;
        let elements = document.querySelectorAll(`input${selectors}, textarea${selectors}, [contenteditable]${selectors}, [editor='dom']${selectors}`);

        elements.forEach((element) => {
            if (element.tagName == 'IFRAME')
                element = element.contentDocument.documentElement;
            if(element === document.activeElement) {
                sendPosition(element);
            }
            updateElement(element, info);
        });
    });
}

function updateElement (element, info) {
    if (!element.crdt) {
        if (element.tagName == 'HTML')
            element.crdt = {init: 'editor'};
        else
            element.crdt = {init: false};
    }
    
    if (element.crdt.init == true && element.domText != true) {
        element.crdt = {init: false};
        if (element.hasAttribute('contenteditable')){
            element.innerHTML = "";
        }
        else {
            element.value = "";
        }
    }
    var start = 0;
    let items = info.eventDelta;
    items.forEach(item => {
        
        if(item.retain) {
            start = item.retain;
        }
        if(item.insert || item.delete) {
            if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
                if(item.insert) {
                    if (element.value != item.insert)
                        _updateElementText(element, item.insert, start, start);
                }
                else if(item.delete) {
                    _updateElementText(element, "", start, start + item.delete);
                }
            } else {
                let collection = info['collection'];
                let document_id = info['document_id'];
                let name = info['name'];
                let html = crdt.getText({collection, document_id, name});
				let domTextEditor = element;
				let value = item.insert;
				if(element.tagName == 'HTML' && element.crdt.init == 'editor') {
                    initDocumentElement(element, collection, document_id, name, value);
                }

				if (item.insert) {
                    let end = start + item.insert.length - 1;
				    if (element.innerHTML != item.insert) {
						domTextEditor.htmlString = html;
						updateDom({ domTextEditor, value, start, end });
				    }
				}
				else if (item.delete) {
                    let end = start + item.delete;
					domTextEditor.htmlString = html;
					updateDom({ domTextEditor, start, end });
				}
            }
        }
    });
}

function _updateElementText (element, value, start, end) {
    if (element.tagName == 'HTML') return;
    let prev_start = element.selectionStart;
    let prev_end = element.selectionEnd;
    element.setRangeText(value, start, end, "end");
	let p = processSelection(element, value, prev_start, prev_end, start, end);
	sendPosition(element);
	_dispatchInputEvent(element, p.value, p.start, p.end, p.prev_start, p.prev_end)
}

export function _dispatchInputEvent(element, content, start, end, prev_start, prev_end) {
    if(eventObj) {
        let detail = {value: content, start, end, prev_start, prev_end};
        let event = new CustomEvent(eventObj.type, { bubbles: true });
        Object.defineProperty(event, 'stopCCText', { writable: false, value: true });
        Object.defineProperty(event, 'target', { writable: false, value: element });
        Object.defineProperty(event, 'detail', { writable: false, value: detail });
        element.dispatchEvent(event);
       
        let inputEvent = new CustomEvent('input', { bubbles: true });
        Object.defineProperty(inputEvent, 'target', { writable: false, value: element });
        Object.defineProperty(inputEvent, 'detail', { writable: false, value: detail });
        element.dispatchEvent(inputEvent);
        
        let textChange = new CustomEvent('textChange', { bubbles: true });
        Object.defineProperty(textChange, 'target', { writable: false, value: element });
        Object.defineProperty(textChange, 'detail', { writable: false, value: detail });
        element.dispatchEvent(textChange);
        eventObj = null;
    }
}

	function initDocumentElement(element, collection, document_id, name, value) {
		try {
			let eid = elementId(element, collection, document_id, name, value);
			if(eid == false) return;
			element.crdt = {init: false};
			element.contentEditable = true;
		}
		catch(err) {
			console.log('canvas init: ' + err);
		}
	}

	function elementId(element, collection, document_id, name, value) {
		try {
			var parser = new DOMParser();
			var dom = parser.parseFromString(value, "text/html");

			let elements = dom.querySelectorAll('*:not(html, [element_id])');

			for(let el of elements) {
				if(el.getAttribute('element_id') == null) {
					el.setAttribute('element_id', CoCreate.uuid.generate(6));
				}
			}

			let html = dom.documentElement.outerHTML;

			if(elements.length > 0) {
				crdt.replaceText({ crud: false, collection, document_id, name, value: html });
				elementId = function() {};
				return false;
			}
		}
		catch(err) {
			console.log('canvas init: ' + err);
		}
	}

function addElementId(value) {
    let dom, isOnlyChildren;
	try{
	    [dom, isOnlyChildren] = parseAll(value);
	}
	finally {
    	if(dom){
    	    if(!isOnlyChildren)
    			dom.setAttribute('element_id', CoCreate.uuid.generate(6));
    		dom.querySelectorAll('*').forEach(el => el.setAttribute('element_id', CoCreate.uuid.generate(6)));
    		value = isOnlyChildren ? dom.innerHTML : dom.outerHTML;
    		return value;
    	}
    	else
    		return value;
	}
}

function parseAll(str) {
	let mainTag = str.match(/\<(?<tag>[a-z0-9]+)(.*?)?\>/).groups.tag;
	if(!mainTag)
		throw new Error('find position: can not find the main tag');

	let doc;
	switch(mainTag) {
		case 'html':
			doc = new DOMParser().parseFromString(str, "text/html");
			return [doc.documentElement, false];
		case 'body':
			doc = new DOMParser().parseFromString(str, "text/html");
			return [doc.body, false];
		case 'head':
			doc = new DOMParser().parseFromString(str, "text/html");
			return [doc.head, false];

		default:
			let con = document.createElement('div');
			con.innerHTML = str;
			return [con, true];
	}
}

init();

observer.init({
    name: 'CoCreateTextAddedNodes',
    observe: ['addedNodes'],
    target: selectors,
    callback (mutation) {
        let isCrdt = mutation.target.getAttribute('crdt');
        if (isCrdt) return;
        initElement(mutation.target);
    }
});

observer.init({
    name: 'CoCreateTextAttribtes',
    observe: ['attributes'],
    attributeName: ['collection', 'document_id', 'name'],
    target: selectors,
    callback (mutation) {
        initElement(mutation.target);
    }
});

export default {initElements, initElement, insertText, deleteText, updateElement, _addEventListeners, insertAdjacentElement, removeElement, setInnerText, setAttribute, removeAttribute, setClass, setStyle, setClassStyle, replaceInnerText};
