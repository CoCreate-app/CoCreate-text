import observer from '@cocreate/observer'
import crud from '@cocreate/crud-client'
import crdt from '@cocreate/crdt'
import cursors from '@cocreate/cursors'
import form from '@cocreate/form'
import { logger } from '@cocreate/utils'

let console = logger('off');

const CoCreateText = {

    selector: "input[collection][document_id][name], textarea[collection][document_id][name]",

    init: function() {
        let elements = document.querySelectorAll(this.selector);
        this.initElements(elements);
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

            crdt.init({ collection, document_id, name, element })
        }
    },

    generateTypeName: function(element) {
        const { collection, document_id, name } = crud.getAttr(element)
        return crdt.generateID(config.organization_Id, collection, document_id, name);
    },

    __initEvents: function(element) {
        const self = this;

        element.addEventListener('select', function() {
            if(this.selectionEnd !== this.selectionStart) {
                self.setPositionInfo(this);
            }
        });

        element.addEventListener('keyup', function(event) {
            let arrows = [37, 38, 39, 40];
            self.setPositionInfo(this);
        });

        element.addEventListener('keydown', function(event) {
            let arrows = [37, 38, 39, 40];
            self.setPositionInfo(this);
        });

        element.addEventListener('click', function(event) {
            self.setPositionInfo(this);
        });

        element.addEventListener('blur', function(event) {
            const id = self.generateTypeName(this);
            crdt.setCursorNull(id);
        });

        element.addEventListener('input', function(event) {
            let nowstart = this.selectionStart - 1;
            let nowend = nowstart;
            let selection_info = self.getSelectionInfo(this);
            let content_text = "";
            let isUpdate = false;
            switch(event.inputType) {
                case 'deleteContentBackward':
                    isUpdate = true;
                    nowstart++;
                    nowend = nowstart + 1;
                    break;
                case 'deleteContentForward':
                    isUpdate = true;
                    nowstart++;
                    nowend = nowstart + 1;
                    break;
                case 'insertLineBreak':
                    isUpdate = true;
                    content_text = "\n";
                    nowend++;
                    break;
                case 'insertText':
                    isUpdate = true;
                    content_text = event.data || "\n";
                    break;
                case 'deleteByCut':
                    isUpdate = true;
                    break;

            }

            if(isUpdate) {
                if(selection_info.is_selected) {
                    //. delete event
                    let character_deleted = selection_info.start - selection_info.end;

                    //cursors.recalculate_local_cursors(this,character_deleted)

                    self.sendChangeData(this, "", selection_info.start, selection_info.end);
                    if(content_text.length > 0) {
                        self.sendChangeData(this, content_text, nowstart, nowend);
                    }
                    self.setPositionInfo(this);
                }
                else {
                    self.sendChangeData(this, content_text, nowstart, nowend);
                }
            }
        })

        /** past events **/
        element.addEventListener('paste', function(event) {
            // return;
            console.log('check paste: text')
            let content_text;
            if(event.detail?.data)
                content_text = event.detail.data;
            else
                content_text = event.clipboardData.getData('Text');
            let start = this.selectionStart;
            let end = this.selectionEnd;
            //. send delete event
            if(start != end) {
                this.setSelectionRange(end, end)
                self.sendChangeData(this, "", start, end, false);
            }
            if(start == end) {
                // to calculate Cursors in collaboration 
                // cursors.recalculate_local_cursors(this,content_text.length)
            }
            //. insert event
            self.sendChangeData(this, content_text, start, start, false);
            event.preventDefault()
        })

        element.addEventListener('cocreate-crdt-update', function(event) {
            var info = event.detail;
            element.crudSetted = true;

            var pos = 0;
            var flag = true;

            info.forEach(item => {
                if(item.retain) {
                    flag = true;
                    pos = item.retain;
                }

                if(item.insert || item.delete) {
                    if(flag == false) pos = 0;
                    flag = false;

                    if(item.insert) {
                        //. insert process
                        self.updateChangeData(this, item.insert, pos, pos)
                    }
                    else if(item.delete) {
                        //. delete process
                        self.updateChangeData(this, "", pos, pos + item.delete);
                    }

                }
            })
        })
    },

    getSelectionInfo: function(el) {
        return {
            is_selected: (el.getAttribute("is_selected") === 'true') ? true : false,
            start: parseInt(el.getAttribute("selection_start")),
            end: parseInt(el.getAttribute("selection_end"))
        }
    },

    setPositionInfo: function(el) {
        const { from, to } = this._getCaretPosition(el);
        let isSelect = from != to;
        this.setSelectionInfo(el, isSelect, from, to)
    },

    _getCaretPosition: function(el) {
        let from = el.selectionStart
        let to = el.selectionEnd
        return { from: from, to: to };
    },

    setSelectionInfo: function(el, isSelect, start, end) {
        el.setAttribute("is_selected", isSelect);
        el.setAttribute("selection_start", start);
        el.setAttribute("selection_end", end);
        this.sendPosition(el, isSelect, start, end);
    },

    sendPosition: function(el, isSelect, start, end) {
        const { collection, document_id, name } = crud.getAttr(el)
        const id = this.generateTypeName(el);
        let from = el.selectionStart;
        let to = el.selectionEnd;
        crdt.setPositionYJS(id, from, to);
        // ToDo: use sendPosition
        // crdt.sendPosition(collection, document_id, name, from, to);
    },

    sendChangeData: function(element, content, start, end, isRemove = true) {
        const { collection, document_id, name, isCrud } = crud.getAttr(element)
        // ToDo: isCrud can be retrieved from crud.getAttr not sure if it will have the correct value
        // const isCrud = element.getAttribute('crud') == "false" ? false : true;

        if(!crud.isSaveAttr(element)) {
            return;
        }

        let character_count = content.length > 0 ? content.length : -1;
        cursors.recalculate_local_cursors(element, character_count);

        //send position when keyUp 
        this.sendPosition(element)
        if(content.length > 0) {
            if(isRemove) {
                element.setRangeText("", start, start + content.length, "start")
            }
            crdt.insertText({
                collection,
                document_id,
                name,
                value: content,
                position: start,
                crud: isCrud
            })
        }
        else {
            if(isRemove) element.setRangeText(" ".repeat(end - start), start, start, "end")
            crdt.deleteText({
                collection,
                document_id,
                name,
                position: start,
                length: end - start,
                crud: isCrud
            })
        }
        if(document.activeElement === element) {
            this.setSelectionInfo(element, false, element.selectionStart, element.selectionStart);
            this.sendPosition(element);
        }
    },

    updateChangeData: function(element, content, start, end) {

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
        } {
            if(content == "" && prev_end >= start) {
                prev_end = (prev_end >= end) ? prev_end - (end - start) : start
            }
        }

        element.selectionStart = prev_start;
        element.selectionEnd = prev_end;
        console.log("prev_end ", prev_end, " prev_start ", prev_start)
        var isFocused = (document.activeElement === element);
        cursors.refresh_mirror(element);

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
