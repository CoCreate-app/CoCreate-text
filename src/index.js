/*global CoCreate, DOMParser, CustomEvent, navigator, Node*/

import observer from '@cocreate/observer';
import crud from '@cocreate/crud-client';
import crdt from '@cocreate/crdt';
import {setInnerText, changeDom, replaceInnerText, getDomPosition} from './domText';
import {contenteditable} from './contenteditable';

let eventObj;
let selector = `[collection][document_id][name]`;
let selectors = `input${selector}, textarea${selector}, [contenteditable]${selector}:not([contenteditable='false'])`;

function init() {
    let elements = document.querySelectorAll(selectors);
    initElements(elements);
    _crdtUpdateListener();
    // document.addEventListener('click', function(){
    //     let element = event.target;
    //     element.focus();
    //     let el = document.activeElement;
    //     let { start, end } = getSelections(el);
    //     console.log('selctions: ', el, start, end);
    // });
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

        if (!isCrdt)
            _addEventListeners(element);
            
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
    const { start, end, range } = getSelections(element);
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
    const { start, end, range } = getSelections(element);
    if(start != end) {
        deleteText(element, start, end, range);
    }
    value = addElementId(value)
    insertText(element, value, start, range);
    event.preventDefault();
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


function _keydown (event) {
    if(event.stopCCText) return;
    let element = event.currentTarget;
    const { start, end, range } = getSelections(element);
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
    let { start, end, range } = getSelections(element);
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

export function getSelections (element) {
    if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
        return {
            start: element.selectionStart,
            end: element.selectionEnd
        };
    } 
    else {
		let document = element.ownerDocument;
		var selection = document.getSelection();
		if (!selection.rangeCount) return { start: 0, end: 0 };

		var range = selection.getRangeAt(0);
        var start = range.startOffset;
        var end = range.endOffset;
		if(range.startContainer != range.endContainer) {
    // 		toDo: replace common ancestor value
		}
// 		let domTextEditor = element.domTextEditor || element;
//         let nodePos = getDomPosition({ domTextEditor, target: range.startContainer.parentElement, start, end });
//         if (nodePos){
//             start = nodePos.start;
//             end = nodePos.end;
//         }
		return { start, end, range };
    }
    
}

export function processSelections(element, value = "", prev_start, prev_end, start, end, range) {
	if (prev_start >= start) {
		if (value == "") {
			prev_start -= end - start;
			prev_end -= end - start;
			prev_start = prev_start < start ? start : prev_start;
		}
		else {
			prev_start += value.length;
			prev_end += value.length;
		}
	} {
		if (value == "" && prev_end >= start) {
			prev_end = (prev_end >= end) ? prev_end - (end - start) : start;
		}
	}
	setSelections(element, prev_start, prev_end, range);
    _dispatchInputEvent(element, value, start, end, prev_start, prev_end);
}

export function setSelections(element, start, end, range) {
    if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
        element.selectionStart = start;
        element.selectionEnd = end;
    } 
    else {
    // 	if (document.activeElement !== element) return;
    	if (range.commonAncestorContainer) {
    	    let prevElement = range.commonAncestorContainer;
    	    if (prevElement.nodeName == '#text')
    	        prevElement = range.commonAncestorContainer.parentElement;
    	    if (prevElement !== element) return;
    	}
    	let document = element.ownerDocument;
    	var selection = document.getSelection();
    	var range = contenteditable._cloneRangeByPosition(element, start, end);
    	selection.removeAllRanges();
    	selection.addRange(range);
    	console.log('setSelection', selection);
    }
    sendPosition(element);
}


export function hasSelection(el) {
	let { start, end } = getSelections(el);
	if(start != end) {
		return true;
	}
}

function sendPosition (element) {
    if (!element) return;
    const { start, end } = getSelections(element);
    const { collection, document_id, name } = crud.getAttr(element);
    if(element.domText != true)
        crdt.sendPosition({ collection, document_id, name, start, end });
}

function deleteText (element, start, end, range) {
    const { collection, document_id, name, isCrud, isSave } = crud.getAttr(element);
    if(isSave == "false") return;
    let length = end - start;
    if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
        crdt.deleteText({ collection, document_id, name, position: start, length, crud: isCrud });
    } else {
        let domTextEditor = element.domTextEditor || element;
        let startEl =  range.startContainer.parentElement;
        let endEl =  range.endContainer.parentElement;
        let target = startEl;
        // if (startEl != endEl) {
        //     target = range.commonAncestorContainer;
        //     // value = target.innerHTML;
        //     // replaceInnerText(domTextEditor, target, value)
        // }
        start = range.startOffset;
        let end = range.endOffset;
        if (start == end)
            start = start -1;
        setInnerText({ domTextEditor, target, start, end});
    }
}

function insertText (element, value, start, range) {
    const { collection, document_id, name, isCrud, isSave } = crud.getAttr(element);
    if(isSave == "false") return;
    if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
        crdt.insertText({ collection, document_id, name, value, position: start, crud: isCrud });
    } else {
        let domTextEditor = element.domTextEditor || element;
        let startEl =  range.startContainer.parentElement;
        let endEl =  range.endContainer.parentElement;
        let target = startEl;
        if (startEl != endEl) {
            target = range.commonAncestorContainer;
            // value = target.innerHTML;
            // replaceInnerText(domTextEditor, target, value)
        }
        let end = start;
        setInnerText({ domTextEditor, target, value, start, end});
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
    // element.crudSetted = true;
    if (!element.crdt) {
        element.crdt = {init: false};
    }
    
    if (element.crdt.init == true && element.domText != true) {
        element.crdt = {};
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
				let target = element;
				
				if (item.insert) {
                    let end = start + item.insert.length - 1;
				    if (element.innerHTML != item.insert) {
				        // contenteditable._insertElementText(element, value, start);
						domTextEditor.htmlString = html;
						changeDom({ domTextEditor, value, start, end });
				    }
				}
				else if (item.delete) {
                    let end = start + item.delete;
				// 	contenteditable._deleteElementText(element, start, end);
					domTextEditor.htmlString = html;
					changeDom({ domTextEditor, start, end });
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
	processSelections(element, value, prev_start, prev_end, start, end);
    // _dispatchInputEvent(element, value, start, end);
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

export default {initElements, initElement, getSelections, setSelections, hasSelection, insertText, deleteText, updateElement, _addEventListeners};
