/*global CustomEvent, navigator*/
import observer from '@cocreate/observer';
import crud from '@cocreate/crud-client';
import crdt from '@cocreate/crdt';
import cursors from '@cocreate/cursors';
import uuid from '@cocreate/uuid';
import {updateDom} from './updateDom';
import {insertAdjacentElement, removeElement, setInnerText, setAttribute, removeAttribute, setClass, setStyle, setClassStyle, replaceInnerText} from './updateText';
import {getSelection, processSelection} from '@cocreate/selection';
import action from '@cocreate/actions';
import './saveDomText';

let eventObj;
let selector = `[collection][document_id][name]`;
let selectors = `input${selector}, textarea${selector}, [contenteditable]${selector}:not([contenteditable='false'])`;

function init() {
    let elements = document.querySelectorAll(selectors);
    initElements(elements);
    _crdtUpdateListener();
    initDocument(document);
}

function initElements (elements) {
    for(let element of elements)
        initElement(element);
}

function initElement (element) {
    const { collection, document_id, name, isRealtime, isCrdt, isCrud, isSave, isRead } = crud.getAttr(element);
    if (document_id == "pending") return;
    if (isCrdt == "false" || isRealtime == "false" || element.type == 'number' || name == '_id') return;
    if (!crud.checkAttrValue(collection) || !crud.checkAttrValue(document_id)) return;
    if (element.tagName === "INPUT" && ["text", "tel", "url"].includes(element.type) || element.tagName === "TEXTAREA" || element.hasAttribute('contenteditable')) {
        if (!collection || !document_id || !name) return;

        if (!isCrdt) {
            if (element.tagName == 'IFRAME'){
                if (isCrdt != 'true')
                    _addEventListeners(element.contentDocument.documentElement);
                let Document = element.contentDocument;
                initDocument(Document);
            }  
            else if (isCrdt != 'true'){ 
                _addEventListeners(element);
            }
        }   
        element.setAttribute('crdt', 'true');
        element.crdt = {init: true};
        crdt.getText({ collection, document_id, name, crud: isCrud, save: isSave, read: isRead }).then(response => {
            if (response === undefined) 
                return;
            if (!response){
                let value;
                if (element.hasAttribute('contenteditable')){
                   value = element.innerHTML;
                }
                else {
                    value = element.value;
                }
                if (value)
                    crdt.replaceText({ collection, document_id, name, value, crud: isCrud, save: isSave, read: isRead });
            }
            else {
                if (element.hasAttribute('contenteditable')){
                   element.innerHTML = '';
                }
                else {
                    element.value = '';
                }
                updateElement({ element, collection, document_id, name, value: response, start: 0 })
            }
        });
    }
}

function initDocument(doc) {
    let documents = window.top.textDocuments;
    if (!documents){
        documents = new Map();
        window.top.textDocuments = documents;
    }
    if (!documents.has(doc)) {
        documents.set(doc);
        doc.addEventListener('selectionchange', (e) => {
            let element = doc.activeElement;
            sendPosition(element);
        }); 
    }
}

export function _addEventListeners (element) {
    element.addEventListener('mousedown', _mousedown);
    element.addEventListener('blur', _blur);
    element.addEventListener('cut', _cut);
    element.addEventListener('paste', _paste);
    element.addEventListener('keydown', _keydown);
    element.addEventListener('beforeinput', _beforeinput);
    element.addEventListener('input', _input);
}

function _mousedown (event) {
    let domTextEditor = event.currentTarget;
    if (domTextEditor.tagName === "INPUT" || domTextEditor.tagName === "TEXTAREA") return;
    let target = event.target;
    // const path = event.path || (event.composedPath && event.composedPath());
    // console.log(path)
	if (!target.id){
        let isEid = domTextEditor.getAttribute('eid');
		if (isEid != 'false' && isEid != null && isEid != undefined){
            let eid = target.getAttribute('eid');
            if (!eid){
                eid = uuid.generate(6);
                setAttribute({ domTextEditor, target, name: 'eid', value: eid });
            }
        }
	}
	let contentEditable = target.closest('[collection][document_id][name]');
	if (contentEditable){
        target = contentEditable;
        const { collection, document_id, name } = crud.getAttr(target);
        if (collection && document_id && name && !target.hasAttribute('contenteditable'))
            target.setAttribute('contenteditable', 'true');
    }
    // sendPosition(element)
}

function _blur (event) {
    let element = event.currentTarget;
    const { collection, document_id, name } = crud.getAttr(element);
    let start = null;
    let end = null;
    cursors.sendPosition({collection, document_id, name, start, end});
}

function _cut (event) {
    let element = event.currentTarget;
    if (element.getAttribute('crdt') == 'false')
        return;
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
    if (start != end) {
        updateText({element, start, end, range});
    }
    event.preventDefault();
}

function _paste (event) {
    let element = event.currentTarget;
    if (element.getAttribute('crdt') == 'false')
        return;
    let value = event.clipboardData.getData('text/plain').replace(/(\r\n|\r)/gm, "\n");;
    const { start, end, range } = getSelection(element);
    if (start != end) {
        updateText({element, start, end, range});
    }
    updateText({element, value, start, range});
    event.preventDefault();
}

function _keydown (event) {
    if (event.stopCCText) return;
    let element = event.currentTarget;
    if (element.getAttribute('crdt') == 'false')
        return;
    const { start, end, range } = getSelection(element);
    if (event.key == "Backspace" || event.key == "Tab" || event.key == "Enter") {
        eventObj = event;
        if (start != end) {
            updateText({element, start, end, range});
        }
        
        if (event.key == "Backspace" && start == end) {
            updateText({element, start: start - 1, end, range});
        }
        else if (event.key == 'Tab') {
            updateText({element, value: "\t", start, range});
        }
        else if (event.key == "Enter") {
            updateText({element, value: "\n", start, range});
        }
        event.preventDefault();
    }
    else if (event.ctrlKey) {
        if (event.keyCode == 90) {
            updateText({element, range, undoRedo: 'undo'});
        }
        else if (event.keyCode == 89) {
            updateText({element, range, undoRedo: 'redo'});
        }
    }
}

function _beforeinput (event) {
    if (event.stopCCText) return;
    let element = event.currentTarget;
    if (element.getAttribute('crdt') == 'false')
        return;
    let { start, end, range } = getSelection(element);
    if (event.data) {
        if (start != end) {
            updateText({element, start, end, range});
        }
        eventObj = event;
        updateText({element, value: event.data, start, range});
        event.preventDefault();
    }
}

function _input (event) {
    if (event.stopCCText) return;
    if (event.data) {
        eventObj = event;
    }
}

function _removeEventListeners (element) {
    element.removeEventListener('blur', _blur);
    element.removeEventListener('cut', _cut);
    element.removeEventListener('paste', _paste);
    element.removeEventListener('keydown', _keydown);
    element.removeEventListener('beforeinput', _beforeinput);
}

let previousPosition = {};
export function sendPosition (element) {
    // if (!element) return;
    const { start, end, range } = getSelection(element);
    if (range) {
        if (range.element){
            element = range.element;
        }
        if (element.tagName == 'HTML' && !element.hasAttribute('collection') || !element.hasAttribute('collection')) {
            element = element.ownerDocument.defaultView.frameElement;
        }
    }
    if (!element) return;
    const { collection, document_id, name, isCrdt } = crud.getAttr(element);
    if (isCrdt == 'false' || !collection || !document_id || !name) return;
    let currentPosition = { collection, document_id, name, start, end };
    if (JSON.stringify(currentPosition) === JSON.stringify(previousPosition))
        return;
    previousPosition = currentPosition;
    element.activeElement = element;
    window.activeElement = element;
    cursors.sendPosition({ collection, document_id, name, start, end });
}

function updateText ({element, value, start, end, range, undoRedo}) {
    if (range) {
        if (range.element)
            element = range.element;
        
        if (element.tagName == 'HTML' && !element.hasAttribute('collection')) 
            element = element.ownerDocument.defaultView.frameElement;
    }
    const { collection, document_id, name, isCrud, isCrdt, isSave } = crud.getAttr(element);
    if (isCrdt == "false") return;
    
    if (undoRedo == 'undo')
        return crdt.undoText({ collection, document_id, name, isCrud, isCrdt, isSave })
    if (undoRedo == 'redo')
        return crdt.redoText({ collection, document_id, name, isCrud, isCrdt, isSave })

    let length = end - start;
    if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
        crdt.updateText({ collection, document_id, name, value, start, length, crud: isCrud, save: isSave });
    } else {
        let startEl =  range.startContainer.parentElement;
        let endEl =  range.endContainer.parentElement;
        if (startEl != endEl) {
        //     target = range.commonAncestorContainer;
        //     // value = target.innerHTML;
        //     // replaceInnerText(domTextEditor, target, value)
        }
        crdt.updateText({ collection, document_id, value, name, start, length, crud: isCrud, save: isSave });
    }
}

function _crdtUpdateListener () {
    window.addEventListener('cocreate-crdt-update', function(event) {
        updateElements({...event.detail});
    });
}

function updateElements({elements, collection, document_id, name, value, start, length, string}){
    if (!elements){
        let selectors = `[collection='${collection}'][document_id='${document_id}'][name='${name}']`;
        elements = document.querySelectorAll(`input${selectors}, textarea${selectors}, [contenteditable]${selectors}, [editor='dom']${selectors}`);
    }
    
    elements.forEach((element) => {
        let isCrdt = element.getAttribute('crdt');
        if (!element.hasAttribute('contenteditable') && isCrdt == 'false') return;

        updateElement({element, collection, document_id, name, value, start, length, string});
    });
}

async function updateElement ({element, collection, document_id, name, value, start, length, string }) {
    if (element.tagName == 'IFRAME') {
        let eid = element.getAttribute('eid')
        element = element.contentDocument.documentElement;
        if (eid != 'false' && eid != null && eid != undefined)
            element.setAttribute('eid', eid)
        if (element.contenteditable != 'false')
            element.contentEditable = true;
    }
    if (value || length) {
        if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
            if (length) {
                _updateElementText(element, "", start, start + length);
            }
            if (value) {
                _updateElementText(element, value, start, start);
            }
        } 
        else {
			let domTextEditor = element;
            if (string == undefined)
                string = await crdt.getText({collection, document_id, name});
            let html = string;
			if (length) {
                let end = start + length;
				updateDom({ domTextEditor, start, end, html });
			}
			if (value) {
			    if (element.innerHTML != value) {
					updateDom({ domTextEditor, value, start, end: start, html });
			    }
			}
        }
    }
}

function _updateElementText (element, value, start, end) {
    if (element.tagName === "INPUT" && ["text", "tel", "url"].includes(element.type) || element.tagName === "TEXTAREA") {
        let prev_start = element.selectionStart;
        let prev_end = element.selectionEnd;
        let activeElement = element.ownerDocument.activeElement;
        element.setRangeText(value, start, end, "end");
        let p = processSelection(element, value, prev_start, prev_end, start, end);
        if (activeElement == element)
            sendPosition(element);
        _dispatchInputEvent(element, p.value, p.start, p.end, p.prev_start, p.prev_end);
    }
}

export function _dispatchInputEvent(element, content, start, end, prev_start, prev_end) {
    let detail = {value: content, start, end, prev_start, prev_end, skip: true};
    let activeElement = element.ownerDocument.activeElement;
    if (activeElement == element)
        detail.skip = false;
    if (eventObj) {
        let event = new CustomEvent(eventObj.type, { bubbles: true });
        Object.defineProperty(event, 'stopCCText', { writable: false, value: true });
        Object.defineProperty(event, 'target', { writable: false, value: element });
        Object.defineProperty(event, 'detail', { writable: false, value: detail });
        element.dispatchEvent(event);
    }   
    let inputEvent = new CustomEvent('input', { bubbles: true });
    Object.defineProperty(inputEvent, 'stopCCText', { writable: false, value: true });
    Object.defineProperty(inputEvent, 'target', { writable: false, value: element });
    Object.defineProperty(inputEvent, 'detail', { writable: false, value: detail });
    element.dispatchEvent(inputEvent);
}

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
    attributeName: ['collection', 'document_id', 'name', 'contenteditable'],
    target: selectors,
    callback (mutation) {
        initElement(mutation.target);
    }
});

action.init({
	name: "undo",
	endEvent: "undo",
	callback: (btn, data) => {
        const { collection, document_id, name, isCrud, isCrdt, isSave } = crud.getAttr(btn);
        crdt.undoText({ collection, document_id, name, isCrud, isCrdt, isSave })
	}
});

action.init({
	name: "redo",
	endEvent: "redo",
	callback: (btn, data) => {
        const { collection, document_id, name, isCrud, isCrdt, isSave } = crud.getAttr(btn);
        crdt.redoText({ collection, document_id, name, isCrud, isCrdt, isSave })
	}
});

init();

export default {initElements, initElement, updateText, updateElement, _addEventListeners, insertAdjacentElement, removeElement, setInnerText, setAttribute, removeAttribute, setClass, setStyle, setClassStyle, replaceInnerText};
