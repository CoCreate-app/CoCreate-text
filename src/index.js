import observer from '@cocreate/observer';
import crud from '@cocreate/crud-client';
import crdt from '@cocreate/crdt';

let eventObj;
const CoCreateText = {

    selector: "input[collection][document_id][name], textarea[collection][document_id][name]",

    init: function() {
        let elements = document.querySelectorAll(this.selector);
        this.initElements(elements);
        this._crdtUpdateListener();
    },

    initElements: function(elements) {
        for(let element of elements)
            this.initElement(element);
    },

    initElement: function(element) {
        const { collection, document_id, name, isRealtime, isCrdt } = crud.getAttr(element);
        if(isCrdt == "false" || isRealtime == "false") return;
        if(!crud.checkAttrValue(collection) && !crud.checkAttrValue(document_id)) return;
        if(element.tagName === "INPUT" && ["text", "email", "tel", "url"].includes(element.type) || element.tagName === "TEXTAREA") {
            if(!collection || !document_id || !name) return;

            if (!isCrdt)
                this._addEventListeners(element);
                
            element.setAttribute('crdt', 'true');
            element.value = "";
            crdt.init({ collection, document_id, name });
        }
    },

    _addEventListeners: function(element) {
        element.addEventListener('click', this._click);
        element.addEventListener('blur', this._blur);
        element.addEventListener('keyup', this._keyup);
        element.addEventListener('cut', this._cut);
        element.addEventListener('paste', this._paste);
        element.addEventListener('keydown', this._keydown);
        element.addEventListener('keypress', this._keypress);
    },

    _click: function(event) {
        let element = event.target;
        CoCreateText.sendPosition(element);
    },

    _blur: function(event) {
        let element = event.target;
        const { collection, document_id, name } = crud.getAttr(element);
        let start = null;
        let end = null;
        crdt.sendPosition({collection, document_id, name, start, end})
    },

    _keyup: function(event) {
        let element = event.target;
        CoCreateText.sendPosition(element);
    },

    _cut: function(event) {
        let element = event.target;
        const { start, end } = CoCreateText.getSelections(element);
        const selection = document.getSelection();
        event.clipboardData.setData('text/plain', selection.toString());
        if(start != end) {
            CoCreateText.deleteText(element, start, end);
        }
        event.preventDefault();
    },

    _paste: function(event) {
        let element = event.target;
        let value = event.clipboardData.getData('Text');
        const { start, end } = CoCreateText.getSelections(element);
        if(start != end) {
            CoCreateText.deleteText(element, start, end);
        }
        CoCreateText.insertText(element, value, start);
        event.preventDefault();
    },

    _keydown: function(event) {
        if(event.stopCCText) return;
        let element = event.target;
        CoCreateText.sendPosition(element);
        const { start, end } = CoCreateText.getSelections(element);
        if(event.key == "Backspace" || event.key == "Tab" || event.key == "Enter") {
            eventObj = event;
            if(start != end) {
                CoCreateText.deleteText(element, start, end);
            }
            if(event.key == "Backspace" && start == end) {
                CoCreateText.deleteText(element, start - 1, end);
            }
            if(event.key == 'Tab') {
                CoCreateText.insertText(element, "\t", start);
            }
            if(event.key == "Enter") {
                CoCreateText.insertText(element, "\n", start);
            }
            event.preventDefault();
        }
    },

    _keypress: function(event) {
        if(event.stopCCText) return;
        let element = event.target;
        let { start, end } = CoCreateText.getSelections(element);
        if(start != end) {
            CoCreateText.deleteText(element, start, end);
        }
        eventObj = event;
        CoCreateText.insertText(element, event.key, start);
        event.preventDefault();
    },

    _removeEventListeners: function(element) {
        element.removeEventListener('click', this._click);
        element.removeEventListener('blur', this._blur);
        element.removeEventListener('keyup', this._keyup);
        element.removeEventListener('cut', this._cut);
        element.removeEventListener('paste', this.paste);
        element.removeEventListener('keydown', this._keydown);
        element.removeEventListener('keypress', this._keypress);
    },

    getSelections: function(element) {
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
    },

    sendPosition: function(element) {
        if (!element) return;
        const { start, end } = this.getSelections(element);
        const { collection, document_id, name } = crud.getAttr(element);
        crdt.sendPosition({ collection, document_id, name, start, end });
    },

    deleteText: function(element, start, end) {
        const { collection, document_id, name, isCrud } = crud.getAttr(element);
        let length = end - start;
        crdt.deleteText({ collection, document_id, name, position: start, length, crud: isCrud });
    },

    insertText: function(element, value, position) {
        const { collection, document_id, name, isCrud, isSave } = crud.getAttr(element);
        if(isSave == "false") return;
        crdt.insertText({ collection, document_id, name, value, position, crud: isCrud });
    },

    _crdtUpdateListener: function() {
        let self = this;
        window.addEventListener('cocreate-crdt-update', function(event) {
            var info = event.detail;
            let collection = info['collection'];
            let document_id = info['document_id'];
            let name = info['name'];
            let selectors = `[collection='${collection}'][document_id='${document_id}'][name='${name}']`;
            // let elements = document.querySelectorAll(`input${selectors}, textarea${selectors}, [contenteditable]${selectors}`);
            let elements = document.querySelectorAll(`input${selectors}, textarea${selectors}`);

            elements.forEach((element) => {
                if(element === document.activeElement) {
                    self.sendPosition(element);
                }
                self._updateElement(element, info);
            });
        });
    },

    _updateElement: function(element, info) {
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
    					this._insertElementText(element, item.insert, pos);
    				}
    				else if (item.delete) {
    					this._deleteElementText(element, pos, pos + item.delete);
    				}
                }
                else {
                    if(item.insert) {
                        this._updateElementText(element, item.insert, pos, pos);
                    }
                    else if(item.delete) {
                        this._updateElementText(element, "", pos, pos + item.delete);
                    }
                }
            }
        });
    },

    _updateElementText: function(element, content, start, end) {

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
            this.sendPosition(element);
        }
        
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


    },
};

CoCreateText.init();

observer.init({
    name: 'CoCreateTextAddedNodes',
    observe: ['addedNodes'],
    target: 'input[collection][document_id][name], textarea[collection][document_id][name]',
    callback: function(mutation) {
        CoCreateText.initElement(mutation.target);
    }
});

observer.init({
    name: 'CoCreateTextAttribtes',
    observe: ['attributes'],
    attributeName: ['collection', 'document_id', 'name'],
    target: 'input[collection][document_id][name], textarea[collection][document_id][name]',
    callback: function(mutation) {
        CoCreateText.initElement(mutation.target);
    }
});

export default CoCreateText;
