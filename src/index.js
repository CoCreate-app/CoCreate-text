import observer from '@cocreate/observer';
import crud from '@cocreate/crud-client';
import crdt from '@cocreate/crdt';

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

    initElement: function(element, data) {
        const { collection, document_id, name, isRealtime, isCrdt } = crud.getAttr(element);
        if(isCrdt == "false" || isRealtime == "false") return;
        if (!crud.checkAttrValue(collection) && !crud.checkAttrValue(document_id)) return;
        if(element.tagName === "INPUT" && ["text", "email", "tel", "url"].includes(element.type) || element.tagName === "TEXTAREA") {
            if(!collection || !document_id || !name) return;

            element.setAttribute('crdt', 'true');
            element.value = "";

            this._addEventListeners(element);

            crdt.init({collection, document_id, name});
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
        CoCreateText.sendPosition({ collection, document_id, name });
    },
    
    _keyup: function(event) {
        let element = event.target;
        CoCreateText.sendPosition(element);
    },
    
    _cut: function(event) {
        let element = event.target;
        const {start, end} = CoCreateText.getSelections(element);
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
        const {start, end} = CoCreateText.getSelections(element);

        if(start != end) {
            CoCreateText.deleteText(element, start, end);
        }
        CoCreateText.insertText(element, value, start);
        event.preventDefault();
    },

    _keydown: function(event) {
        let element = event.target;
        const {start, end} = CoCreateText.getSelections(element);
        CoCreateText.sendPosition(element);
        if(start != end) {
            CoCreateText.deleteText(element, start, end);
        }
        if (event.key == "Backspace" && start == end) {
            CoCreateText.deleteText(element, start -1, end);
            event.preventDefault();
        }
        if (event.key == 'Tab') {
            CoCreateText.insertText(element, "\t", start);
            event.preventDefault();
        }
        if (event.key == "Enter") {
            CoCreateText.insertText(element, "\n", start);
            event.preventDefault();
        }
    },
   
    _keypress: function(event) {
        let element = event.target;
        let {start} = CoCreateText.getSelections(element);
        if (event.key == "Enter") return;
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

    getSelections: function(el) {
        return {
            start: el.selectionStart,
            end: el.selectionEnd
        };
    },
    
    sendPosition: function(el) {
        const { collection, document_id, name } = crud.getAttr(el);
        let start = el.selectionStart;
        let end = el.selectionEnd;
        crdt.sendPosition({collection, document_id, name, start, end});
    },

    deleteText: function(element, start, end) {
        const { collection, document_id, name, isCrud } = crud.getAttr(element);
        let length = end - start; 
        crdt.deleteText({ collection, document_id, name, position: start, length, crud: isCrud });
    },
    
    insertText: function(element, value, position) {
        const { collection, document_id, name, isCrud, isSave} = crud.getAttr(element);
        if (isSave == "false") return;
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
        	let elements = document.querySelectorAll(`input${selectors}, textarea${selectors}`);
        
        	elements.forEach((element) => {
                if(element === document.activeElement){
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

                if(item.insert) {
                    this._updateElementText(element, item.insert, pos, pos);
                }
                else if(item.delete) {
                    this._updateElementText(element, "", pos, pos + item.delete);
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
       
        if(element === document.activeElement){
            this.sendPosition(element);
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
        CoCreateText._removeEventListeners(mutation.target);
        CoCreateText.initElement(mutation.target);
    }
});

export default CoCreateText;