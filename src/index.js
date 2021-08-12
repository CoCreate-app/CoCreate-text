import observer from '@cocreate/observer';
import crud from '@cocreate/crud-client';
import crdt from '@cocreate/crdt';
// import contenteditable from './contenteditable';

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
    if(isCrdt == "false" || isRealtime == "false") return;
    if(!crud.checkAttrValue(collection) && !crud.checkAttrValue(document_id)) return;
    if(element.tagName === "INPUT" && ["text", "email", "tel", "url"].includes(element.type) || element.tagName === "TEXTAREA" || element.hasAttribute('contenteditable')) {
        if(!collection || !document_id || !name) return;

        if (!isCrdt)
            _addEventListeners(element);
            
        element.setAttribute('crdt', 'true');
        
        if (element.hasAttribute('contenteditable')){
            element.innerHTML = "";
        }
        else {
            element.value = "";
        }
        crdt.init({ collection, document_id, name });
    }
}

function _addEventListeners (element) {
    element.addEventListener('click', _click);
    element.addEventListener('blur', _blur);
    element.addEventListener('keyup', _keyup);
    element.addEventListener('cut', _cut);
    element.addEventListener('paste', _paste);
    element.addEventListener('keydown', _keydown);
    element.addEventListener('keypress', _keypress);
}

function _click (event) {
    let element = event.target;
    sendPosition(element);
}

function _blur (event) {
    let element = event.target;
    const { collection, document_id, name } = crud.getAttr(element);
    let start = null;
    let end = null;
    crdt.sendPosition({collection, document_id, name, start, end})
}

function _keyup (event) {
    let element = event.target;
    sendPosition(element);
}

function _cut (event) {
    let element = event.target;
    const { start, end } = getSelections(element);
    const selection = document.getSelection();
    event.clipboardData.setData('text/plain', selection.toString());
    if(start != end) {
        deleteText(element, start, end);
    }
    event.preventDefault();
}

function _paste (event) {
    let element = event.target;
    let value = event.clipboardData.getData('Text');
    const { start, end } = getSelections(element);
    if(start != end) {
        deleteText(element, start, end);
    }
    insertText(element, value, start);
    event.preventDefault();
}

function _keydown (event) {
    if(event.stopCCText) return;
    let element = event.target;
    sendPosition(element);
    const { start, end } = getSelections(element);
    if(event.key == "Backspace" || event.key == "Tab" || event.key == "Enter") {
        eventObj = event;
        if(start != end) {
            deleteText(element, start, end);
        }
        if(event.key == "Backspace" && start == end) {
            deleteText(element, start - 1, end);
        }
        if(event.key == 'Tab') {
            insertText(element, "\t", start);
        }
        if(event.key == "Enter") {
            insertText(element, "\n", start);
        }
        event.preventDefault();
    }
}

function _keypress (event) {
    if(event.stopCCText) return;
    let element = event.target;
    let { start, end } = getSelections(element);
    if(start != end) {
        deleteText(element, start, end);
    }
    eventObj = event;
    insertText(element, event.key, start);
    event.preventDefault();
}

function _removeEventListeners (element) {
    element.removeEventListener('click', _click);
    element.removeEventListener('blur', _blur);
    element.removeEventListener('keyup', _keyup);
    element.removeEventListener('cut', _cut);
    element.removeEventListener('paste', paste);
    element.removeEventListener('keydown', _keydown);
    element.removeEventListener('keypress', _keypress);
}

function getSelections (element) {
    if (element.hasAttribute('contenteditable')){
		let document = element.ownerDocument;
		var selection = document.getSelection();
		if (!selection.rangeCount) return null;

		var _range = selection.getRangeAt(0);
		var selected = _range.toString().length;
		var range = _range.cloneRange();
		range.selectNodeContents(element);
		range.setEnd(_range.endContainer, _range.endOffset);
	
		var end = range.toString().length;
		var start = selected ? end - selected : end;

		return { start: start, end: end };
    }
    else
    return {
        start: element.selectionStart,
        end: element.selectionEnd
    };
}

function sendPosition (element) {
    if (!element) return;
    const { start, end } = getSelections(element);
    const { collection, document_id, name } = crud.getAttr(element);
    crdt.sendPosition({ collection, document_id, name, start, end });
}

function deleteText (element, start, end) {
    const { collection, document_id, name, isCrud } = crud.getAttr(element);
    let length = end - start;
    crdt.deleteText({ collection, document_id, name, position: start, length, crud: isCrud });
}

function insertText (element, value, position) {
    const { collection, document_id, name, isCrud, isSave } = crud.getAttr(element);
    if(isSave == "false") return;
    crdt.insertText({ collection, document_id, name, value, position, crud: isCrud });
}

function _crdtUpdateListener () {
    window.addEventListener('cocreate-crdt-update', function(event) {
        var info = event.detail;
        let collection = info['collection'];
        let document_id = info['document_id'];
        let name = info['name'];
        let selectors = `[collection='${collection}'][document_id='${document_id}'][name='${name}']`;
        let elements = document.querySelectorAll(`input${selectors}, textarea${selectors}, [contenteditable]${selectors}`);
        // let elements = document.querySelectorAll(`input${selectors}, textarea${selectors}`);

        elements.forEach((element) => {
            if(element === document.activeElement) {
                sendPosition(element);
            }
            _updateElement(element, info);
        });
    });
}

function _updateElement (element, info) {
    element.crudSetted = true;

    var pos = 0;
    var flag = true;
    let items = info.eventDelta;
    items.forEach(item => {
        if(item.retain) {
            flag = true;
            pos = item.retain;
        }

        if(item.insert || item.delete) {
            if(flag == false) pos = 0;
            flag = false;
            
            if (element.hasAttribute('contenteditable')){
				if (item.insert) {
					contenteditable._insertElementText(element, item.insert, pos);
				}
				else if (item.delete) {
					contenteditable._deleteElementText(element, pos, pos + item.delete);
				}
            }
            else {
                if(item.insert) {
                    _updateElementText(element, item.insert, pos, pos);
                }
                else if(item.delete) {
                    _updateElementText(element, "", pos, pos + item.delete);
                }
            }
        }
    });
}

function _updateElementText (element, content, start, end) {

    let prev_start = element.selectionStart;
    let prev_end = element.selectionEnd;
    element.setRangeText(content, start, end, "end");

    if(prev_start >= start) {
        if(content == "") {
            prev_start -= end - start;
            prev_end -= end - start;
            prev_start = prev_start < start ? start : prev_start;
        }
        else {
            prev_start += content.length;
            prev_end += content.length;
        }
        if(content == "" && prev_end >= start) {
            prev_end = (prev_end >= end) ? prev_end - (end - start) : start;
        }
        element.selectionStart = prev_start;
    }
    else {

        element.selectionStart = prev_start;
        element.selectionEnd = prev_end;
    }

    if(element === document.activeElement) {
        sendPosition(element);
    }
    
    _dispatchInputEvent(element);
}

function _dispatchInputEvent(element) {
    if(eventObj) {
        let event = new CustomEvent(eventObj.type, { bubbles: true });
        Object.defineProperty(event, 'stopCCText', { writable: false, value: true });
        Object.defineProperty(event, 'target', { writable: false, value: eventObj.target });
        element.dispatchEvent(event);
       
        let inputEvent = new CustomEvent('input', { bubbles: true });
        Object.defineProperty(inputEvent, 'target', { writable: false, value: eventObj.target });
        element.dispatchEvent(inputEvent);
        eventObj = null;
    }
} 

// Contenteditable Functions
const contenteditable = {	
	_insertElementText: function(element, content, position) {
		if (!content || content === '') return;

		var selection = window.getSelection();
		var curCaret = getSelections(element);

		var range = this._cloneRangeByPosition(element, position, position);
		var tmp = document.createElement("div");
		var frag = document.createDocumentFragment(),
			node;

		tmp.innerHTML = content;

		while ((node = tmp.firstChild)) {
			frag.appendChild(node);
		}
		range.insertNode(frag);

		if (!curCaret) {
			// let curCaret = {start: 0, end: 0}
			
			selection.addRange(range);
			selection.removeRange(range);
			return;
		}

		this._selectionProcessing(element, content, curCaret.start, curCaret.end, position, position);
	},

	_deleteElementText: function(element, start, end) {
		var content_length = end - start;
		if (!content_length) return;
	
		var curCaret = getSelections(element);
		var selection = window.getSelection();
		var range = this._cloneRangeByPosition(element, start, end);
		if (range) range.deleteContents();


		if (!curCaret) {
			selection.removeRange(range);
			return;
		}

		this._selectionProcessing(element, "", curCaret.start, curCaret.end, start, end);
	},
	
	_selectionProcessing: function(element, content, prev_start, prev_end, start, end) {
		if (prev_start >= start) {
			if (content == "") {
				prev_start -= end - start;
				prev_end -= end - start;
				prev_start = prev_start < start ? start : prev_start;
			}
			else {
				prev_start += content.length;
				prev_end += content.length;
			}
		} {
			if (content == "" && prev_end >= start) {
				prev_end = (prev_end >= end) ? prev_end - (end - start) : start;
			}
		}
		this.setSelection(element, prev_start, prev_end);
		return { start: prev_start, end: prev_end };
	},
	
	setSelection: function(element, start, end) {
		if (document.activeElement !== element) return;

		var selection = document.getSelection();
		var range = this._cloneRangeByPosition(element, start, end);
		selection.removeAllRanges();
		selection.addRange(range);
		
		sendPosition(element);
         _dispatchInputEvent(element);
	},
	
	_cloneRangeByPosition: function(element, start, end, range) {
		if (!range) {
			range = document.createRange();
			range.selectNode(element);
			range.setStart(element, 0);
			this.start = start;
			this.end = end;
		}

		if (element && (this.start > 0 || this.end > 0)) {
			if (element.nodeType === Node.TEXT_NODE) {

				if (element.textContent.length < this.start) this.start -= element.textContent.length;
				else if (this.start > 0) {
					range.setStart(element, this.start);
					this.start = 0;
				}

				if (element.textContent.length < this.end) this.end -= element.textContent.length;
				else if (this.end > 0) {
					range.setEnd(element, this.end);
					this.end = 0;
				}
			}
			else {
				for (var lp = 0; lp < element.childNodes.length; lp++) {
					range = this._cloneRangeByPosition(element.childNodes[lp], this.start, this.end, range);
					if (this.start === 0 && this.end === 0) break;
				}
			}
		}

		return range;
	},

};


init();

observer.init({
    name: 'CoCreateTextAddedNodes',
    observe: ['addedNodes'],
    target: selectors,
    callback (mutation) {
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

export default {initElements, initElement, getSelections};
