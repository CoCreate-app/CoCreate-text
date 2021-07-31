import observer from '@cocreate/observer'
import crud from '@cocreate/crud-client'
import crdt from '@cocreate/crdt'
import cursors from '@cocreate/cursors'
import form from '@cocreate/form'
import { logger } from '@cocreate/utils'

let console = logger('all');

const CoCreateText = {

    selector: "input[collection][document_id][name], textarea[collection][document_id][name]",

    init: function() {
        let elements = document.querySelectorAll(this.selector);
        this.initElements(elements);
        this.crdtUpdateListener()
    },

    initElements: function(elements) {
        for(let element of elements)
            this.initElement(element);
    },

    initElement: function(element, data) {
        const { collection, document_id, name, isRealtime, isCrdt } = crud.getAttr(element);
        if(isCrdt == "false" || isRealtime == "false") return;
        if(element.tagName === "INPUT" && ["text", "email", "tel", "url"].includes(element.type) || element.tagName === "TEXTAREA") {
            if(!collection || !document_id || !name) return;

            element.setAttribute('crdt', 'true')
            element.value = ""

            this.__initEvents(element);

            crdt.init({collection, document_id, name, element})
        }
    },

    __initEvents: function(element) {
        const self = this;

        element.addEventListener('select', function() {
            if(this.selectionEnd !== this.selectionStart) {
                self.sendPosition(this);
            }
        });

        element.addEventListener('keyup', function(event) {
            let arrows = [37, 38, 39, 40];
            self.sendPosition(this);
        });

        element.addEventListener('keydown', function(event) {
            let arrows = [37, 38, 39, 40];
            self.sendPosition(this);
        });

        element.addEventListener('click', function(event) {
            self.sendPosition(this);
        });

        element.addEventListener('blur', function(event) {
            const { collection, document_id, name } = crud.getAttr(element)
            crdt.sendPosition(collection, document_id, name, null, null)
        });

        element.addEventListener('cut', function(event) {
            let start = this.selectionStart;
            let end = this.selectionEnd;
            const selection = document.getSelection();
            event.clipboardData.setData('text/plain', selection.toString());
            if(start != end) {
                self.deleteText(this, start, end);
            }
            event.preventDefault()
        })
        
        element.addEventListener('paste', function(event) {
            let value = event.clipboardData.getData('Text');
            let start = this.selectionStart;
            let end = this.selectionEnd;

            if(start != end) {
                self.deleteText(this, start, end);
            }
            self.insertText(this, value, start);
            event.preventDefault()
        })
        
        element.addEventListener('keydown', function(event) {
            let start = this.selectionStart;
            let end = this.selectionEnd;
            if (event.key == "Backspace") {
                if(start != end) {
                    self.deleteText(this, start, end);
                }
                else {
                    self.deleteText(this, start -1, end);
                }
                event.preventDefault()
            }
        })
        
        element.addEventListener('keypress', function(event) {
            let start = this.selectionStart;
            let end = this.selectionEnd;
            if(start != end) {
                self.deleteText(this, start, end);
            }
            if (event.key == "Enter") {
                self.insertText(this, "\n", start);
            }
            self.insertText(this, event.key, start);
            event.preventDefault()
        })

    },

    sendPosition: function(el) {
        const { collection, document_id, name } = crud.getAttr(el);
        let start = el.selectionStart;
        let end = el.selectionEnd;
        crdt.sendPosition(collection, document_id, name, start, end);
    },

    deleteText: function(element, start, end) {
        const { collection, document_id, name, isCrud } = crud.getAttr(element)
        let length = end - start; 
        crdt.deleteText({ collection, document_id, name, position: start, length, crud: isCrud })
    },
    
    insertText: function(element, value, position) {
        const { collection, document_id, name, isCrud, isSave} = crud.getAttr(element)
        if (isSave == "false") return;
        crdt.insertText({ collection, document_id, name, value, position, crud: isCrud })
    },

    crdtUpdateListener: function() {
        let self = this;
        window.addEventListener('cocreate-crdt-update', function(event) {
            var info = event.detail;
            let collection = info['collection']
            let document_id = info['document_id']
            let name = info['name']
        	let selectors = `[collection='${collection}'][document_id='${document_id}'][name='${name}']`
        	let elements = document.querySelectorAll(`input${selectors}, textarea${selectors}`);
        
        	elements.forEach((element) => {
        		self.updateElement(element, info)
        	})
        })
    },
    
    updateElement: function(element, info) {
        element.crudSetted = true;

        var pos = 0;
        var flag = true;
        let items = info.eventDelta
        items.forEach(item => {
            if(item.retain) {
                flag = true;
                pos = item.retain;
            }

            if(item.insert || item.delete) {
                if(flag == false) pos = 0;
                flag = false;

                if(item.insert) {
                    this.updateElementText(element, item.insert, pos, pos)
                }
                else if(item.delete) {
                    this.updateElementText(element, "", pos, pos + item.delete);
                }

            }
        })
    },

    updateElementText: function(element, content, start, end) {

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
                prev_end = (prev_end >= end) ? prev_end - (end - start) : start
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
}

CoCreateText.init();

observer.init({
    name: 'CoCreateTextAddedNodes',
    observe: ['addedNodes'],
    target: 'input[collection][document_id][name], textarea[collection][document_id][name]',
    callback: function(mutation) {
        CoCreateText.initElement(mutation.addedNodes)
    }
});

observer.init({
    name: 'CoCreateTextAttribtes',
    observe: ['attributes'],
    attributeName: ['collection', 'document_id', 'name'],
    callback: function(mutation) {
        CoCreateText.initElement(mutation.target)
    }
});

export default CoCreateText;