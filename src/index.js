/*global CustomEvent, navigator*/
import observer from '@cocreate/observer';
import crud from '@cocreate/crud-client';
import crdt from '@cocreate/crdt';
import cursors from '@cocreate/cursors';
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
    document.addEventListener('selectionchange', (e) => {
        let element = document.activeElement;
        sendPosition(element)
    });
}

function initElements (elements) {
    for(let element of elements)
        initElement(element);
}

function initElement (element) {
    const { collection, document_id, name, isRealtime, isCrdt, isCrud, isSave, isRead } = crud.getAttr(element);
    if(document_id == "pending") return;
    if(isCrdt == "false" || isRealtime == "false" || element.type == 'number') return;
    if(!crud.checkAttrValue(collection) && !crud.checkAttrValue(document_id)) return;
    if(element.tagName === "INPUT" && ["text", "email", "tel", "url"].includes(element.type) || element.tagName === "TEXTAREA" || element.hasAttribute('contenteditable')) {
        if(!collection || !document_id || !name) return;

        if (!isCrdt) {
            if (element.tagName == 'IFRAME'){
                _addEventListeners(element.contentDocument.documentElement);
                let Document = element.contentDocument
                Document.addEventListener('selectionchange', (e) => {
                    let element = Document.activeElement;
                    sendPosition(element)
                });            }  
            else{ 
                _addEventListeners(element);
            }
        }   
        element.setAttribute('crdt', 'true');
        element.crdt = {init: true};
        crdt.getText({ collection, document_id, name, crud: isCrud, save: isSave, read: isRead }).then(response => {
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

export function _addEventListeners (element) {
    element.addEventListener('blur', _blur);
    element.addEventListener('cut', _cut);
    element.addEventListener('paste', _paste);
    element.addEventListener('keydown', _keydown);
    element.addEventListener('beforeinput', _beforeinput);
    element.addEventListener('input', _input);
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
        updateText({element, start, end, range});
    }
    event.preventDefault();
}

function _paste (event) {
    let element = event.currentTarget;
    let value = event.clipboardData.getData('Text');
    const { start, end, range } = getSelection(element);
    if(start != end) {
        updateText({element, start, end, range});
    }
    updateText({element, value, start, range});
    event.preventDefault();
}

function _keydown (event) {
    if(event.stopCCText) return;
    let element = event.currentTarget;
    const { start, end, range } = getSelection(element);
    if(event.key == "Backspace" || event.key == "Tab" || event.key == "Enter") {
        eventObj = event;
        if(start != end) {
            updateText({element, start, end, range});
        }
        
        if(event.key == "Backspace" && start == end) {
            updateText({element, start: start - 1, end, range});
        }
        else if(event.key == 'Tab') {
            updateText({element, value: "\t", start, range});
        }
        else if(event.key == "Enter") {
            updateText({element, value: "\n", start, range});
        }
        event.preventDefault();
    }
    else if (event.ctrlKey) {
        if (event.keyCode == 90) 
            console.log('Undo');
        else if (event.keyCode == 89) 
            console.log('Redo');
    }
}

function _beforeinput (event) {
    if(event.stopCCText) return;
    let element = event.currentTarget;
    let { start, end, range } = getSelection(element);
    if (event.data) {
        if(start != end) {
            updateText({element, start, end, range});
        }
        eventObj = event;
        updateText({element, value: event.data, start, range});
        event.preventDefault();
    }
}

function _input (event) {
    if(event.stopCCText) return;
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

export function sendPosition (element) {
    if (!element) return;
    const { start, end } = getSelection(element);
    if (element.tagName == 'HTML' && !element.hasAttribute('collection') || !element.hasAttribute('collection')) 
        element = element.ownerDocument.defaultView.frameElement;
    if (!element) return;
    const { collection, document_id, name, isCrdt } = crud.getAttr(element);
    if (isCrdt == 'false' || !collection || !document_id || !name) return;
    cursors.sendPosition({ collection, document_id, name, start, end });
}

function updateText ({element, value, start, end, range}) {
    if (element.tagName == 'HTML' && !element.hasAttribute('collection')) 
        element = element.ownerDocument.defaultView.frameElement;
    const { collection, document_id, name, isCrud, isCrdt, isSave } = crud.getAttr(element);
    if(isCrdt == "false") return;
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

function updateElements({elements, collection, document_id, name, value, start, length}){
    if(!elements){
        let selectors = `[collection='${collection}'][document_id='${document_id}'][name='${name}']`;
        elements = document.querySelectorAll(`input${selectors}, textarea${selectors}, [contenteditable]${selectors}, [editor='dom']${selectors}`);
    }
    
    elements.forEach((element) => {
        let isCrdt = element.getAttribute('crdt');
        // if(isCrdt == 'false' && !element.hasAttribute('crdt') && !element.contentEditable) return;
        // if(element.hasAttribute('contenteditable')){
            // let isEditable = element.getAttribute('contenteditable');
        if (!element.hasAttribute('contenteditable') && isCrdt == 'false') return;

        updateElement({element, collection, document_id, name, value, start, length});
    });
}

async function updateElement ({element, collection, document_id, name, value, start, length }) {
    if (element.tagName == 'IFRAME') {
        element = element.contentDocument.documentElement;
        if (element.contenteditable != 'false')
            element.contentEditable = true;
    }
    if(value || length) {
        if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
            if(length) {
                _updateElementText(element, "", start, start + length);
            }
            if(value) {
                if (element.value != value)
                    _updateElementText(element, value, start, start);
            }
        } 
        else {
			let domTextEditor = element;
            let html = await crdt.getText({collection, document_id, name});
			if (length) {
                let end = start + length;
				updateDom({ domTextEditor, start, end, html });
			}
			if (value) {
			    if (element.innerHTML != value) {
					domTextEditor.htmlString = html;
					updateDom({ domTextEditor, value, start, end: start });
			    }
			}
        }
    }
}

function _updateElementText (element, value, start, end) {
    if (element.tagName == 'HTML' || element.type == 'number') return;
    let prev_start = element.selectionStart;
    let prev_end = element.selectionEnd;
    let activeElement = element.ownerDocument.activeElement;
    element.setRangeText(value, start, end, "end");
	let p = processSelection(element, value, prev_start, prev_end, start, end);
	if(activeElement == element)
	    sendPosition(element);
	_dispatchInputEvent(element, p.value, p.start, p.end, p.prev_start, p.prev_end);
}

export function _dispatchInputEvent(element, content, start, end, prev_start, prev_end) {
    let detail = {value: content, start, end, prev_start, prev_end, skip: true};
    if(eventObj) {
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
    attributeName: ['collection', 'document_id', 'name'],
    target: selectors,
    callback (mutation) {
        initElement(mutation.target);
    }
});

init();

export default {initElements, initElement, updateText, updateElement, _addEventListeners, insertAdjacentElement, removeElement, setInnerText, setAttribute, removeAttribute, setClass, setStyle, setClassStyle, replaceInnerText};
