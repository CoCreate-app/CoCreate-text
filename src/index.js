import observer from '@cocreate/observer'
import crud from '@cocreate/crud-client'
import crdt from '@cocreate/crdt'
import cursors from '@cocreate/cursors'
import form from '@cocreate/form'
import { logger } from '@cocreate/utils'

let console = logger('off');

const CoCreateText = {
  elements: [],

  init: function() {
    this.initElement(document);
    // this.initSockets();
  },

  refreshElement: function(mutation) {
    let element = mutation.target;
    if (!element) return;
    const tagName = element.tagName.toLowerCase();
    if (!['input', 'textarea'].includes(tagName) ||
      !element.getAttribute('data-document_id') ||
      !element.getAttribute('name')) {
      return
    }

    if (!crud.isCRDT(element)) return;

    // if (!observer.getInitialized(element, 'text')) {
      this.__initEvents(element);
    // }
    // observer.setInitialized(element, 'text');

    if (crud.checkAttrValue(element.getAttribute('data-document_id'))) {
      // element.value = "";
      this.createYDoc(element, true);
    }

  },

  initElement: function(container) {
    var self = this;
    let fetch_container = container || document;

    let elements = fetch_container.querySelectorAll('input[data-document_id][name], textarea[data-document_id][name]');
    if (elements.length == 0 &&
      fetch_container != document &&
      fetch_container.hasAttribute('data-document_id') &&
      fetch_container.hasAttribute('name')) {
      elements = [fetch_container];
    }

    elements.forEach((element) => {
      //ToDo: isCrdt Needs to be improved and located in crdt
      // if (!crud.isCRDT(element)) {
      //   return;
      // }

      if (self.checkExistElement(element)) {
        // this.setInitValue(elements[i])
        return;
      }

      // if (observer.getInitialized(element, 'text')) {
      //   return;
      // }
      // observer.setInitialized(element, 'text');

      self.__initEvents(element);

      if (crud.checkAttrValue(element.getAttribute('data-document_id'))) {
        self.createYDoc(element);

      }
      else {
        //. register create document_id event
        element.addEventListener('set-document_id', function(event) {
          let el = this;
          let text_str = el.value;

          self.createYDoc(el);

          el.value = "";
          self.sendChangeData(el, text_str, 0, text_str.length);
        })
      }
    })
  },

  checkExistElement: function(element) {
    for (var i = 0; i < this.elements.length; i++) {
      if (this.elements[i].isSameNode(element)) {
        return true;
      }
    }
    return false;
  },

  setInitValue: function(element) {
    var typeId = this.generateTypeName(element);
    var value = crdt.getWholeString(typeId);
    element.value = value;

    // input.setValue(element, value);
  },

  createYDoc: function(element, isExclude) {
    const { collection, document_id, name } = crud.getAttr(element)
    if (!crud.checkAttrValue(collection) || !crud.checkAttrValue(document_id) || !crud.checkAttrValue(name)) return;
    const status = crdt.init({ collection, document_id, name, element })
    if (!isExclude) {
      this.elements.push(element)
    }
    else {
      element.value = crdt.getText({ collection, document_id, name })
      // input.setValue(element, crdt.getText({collection, document_id, name }));
    }
  },


  __initEvents: function(input_element) {

    //. selection event
    const self = this;

    input_element.addEventListener('select', function() {
      if (this.selectionEnd !== this.selectionStart) {
        self.setSelectionInfo(this, true, this.selectionStart, this.selectionEnd)

        if (document.activeElement === this)
          self.sendPosition(this);
      }
    });

    input_element.addEventListener('keyup', function(event) {
      let arrows = [37, 38, 39, 40];
      if (arrows.indexOf(event.keyCode) != -1) {
        self.sendPosition(this);
      }
    });

    input_element.addEventListener('keydown', function(event) {
      let arrows = [37, 38, 39, 40];
      if (arrows.indexOf(event.keyCode) != -1) {
        //console.log("keydown ---- ")
        self.sendPosition(this);
      }
    });

    input_element.addEventListener('click', function(event) {
      if (document.activeElement === this)
        self.sendPosition(this);
    });

    input_element.addEventListener('blur', function(event) {
      const id = self.generateTypeName(this);
      crdt.setCursorNull(id);
    });

    input_element.addEventListener('input', function(event) {
      let nowstart = this.selectionStart - 1;
      let nowend = nowstart;
      let selection_info = self.getSelectionInfo(this);
      let content_text = "";
      let isUpdate = false;
      switch (event.inputType) {
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

      if (isUpdate) {
        if (selection_info.is_selected) {
          //. delete event
          let character_deleted = selection_info.start - selection_info.end;

          //cursors.recalculate_local_cursors(this,character_deleted)

          self.sendChangeData(this, "", selection_info.start, selection_info.end);
          if (content_text.length > 0) {
            self.sendChangeData(this, content_text, nowstart, nowend);
          }
          self.setSelectionInfo(this, false, this.selectionStart, this.selectionStart);
        }
        else {
          self.sendChangeData(this, content_text, nowstart, nowend);
        }
      }
    })

    /** unselect events **/
    input_element.addEventListener('blur', function(e) {
      self.setSelectionInfo(this, false, this.selectionStart, this.selectionStart);
    })
    input_element.addEventListener('click', function(e) {
      self.setSelectionInfo(this, false, this.selectionStart, this.selectionStart);
    })

    /** past events **/
    input_element.addEventListener('paste', function(event) {
      // return;
      console.log('check paste: text')
      let content_text;
      if (event.detail?.data)
        content_text = event.detail.data;
      else
        content_text = event.clipboardData.getData('Text');
      let start = this.selectionStart;
      let end = this.selectionEnd;
      //. send delete event
      if (start != end) {
        this.setSelectionRange(end, end)
        self.sendChangeData(this, "", start, end, false);
      }
      if (start == end) {
        // to calculate Cursors in collaboration 
        // cursors.recalculate_local_cursors(this,content_text.length)
      }
      //. insert event
      self.sendChangeData(this, content_text, start, start, false);
      event.preventDefault()
    })

    input_element.addEventListener('cocreate-crdt-update', function(event) {
      var info = event.detail;
      input_element.crudSetted = true;

      var pos = 0;
      var flag = true;

      info.forEach(item => {
        if (item.retain) {
          flag = true;
          pos = item.retain;
        }

        if (item.insert || item.delete) {
          if (flag == false) pos = 0;
          flag = false;

          if (item.insert) {
            //. insert process
            self.updateChangeData(this, item.insert, pos, pos)
          }
          else if (item.delete) {
            //. delete process
            self.updateChangeData(this, "", pos, pos + item.delete);
          }

        }
      })
    })
  },

  setSelectionInfo: function(e, isSelect, start, end) {
    e.setAttribute("is_selected", isSelect);
    e.setAttribute("selection_start", start);
    e.setAttribute("selection_end", end);
    //console.log("swelect",e)
    this.sendPosition(e);
  },

  getSelectionInfo: function(e) {
    return {
      is_selected: (e.getAttribute("is_selected") === 'true') ? true : false,
      start: parseInt(e.getAttribute("selection_start")),
      end: parseInt(e.getAttribute("selection_end"))
    }
  },

  // Todo: Add new crud
  sendChangeData: function(element, content, start, end, isRemove = true) {
    const { collection, document_id, name } = crud.getAttr(element)
    const isCrud = element.getAttribute('data-crud') == "false" ? false : true;

    if (!document_id || document_id === "") {
      form.request({ element: element, nameAttr: "name" })
      element.setAttribute('data-document_id', 'pending');
      return;
    }

    if (document_id == 'pending') {
      return;
    }

    if (!crud.isSaveAttr(element)) {
      return;
    }
    //console.log("SendChangeDataFrom Cocreate-Text")
    let character_count = content.length > 0 ? content.length : -1;
    cursors.recalculate_local_cursors(element, character_count);

    //send position when keyUp 
    this.sendPosition(element)
    if (content.length > 0) {
      if (isRemove) {
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
      if (isRemove) element.setRangeText(" ".repeat(end - start), start, start, "end")
      crdt.deleteText({
        collection,
        document_id,
        name,
        position: start,
        length: end - start,
        crud: isCrud
      })
    }
    if (document.activeElement === element) {
      this.setSelectionInfo(element, false, element.selectionStart, element.selectionStart);
      this.sendPosition(element);
    }
  },

  updateChangeData: function(element, content, start, end) {

    let prev_start = element.selectionStart;
    let prev_end = element.selectionEnd;
    element.setRangeText(content, start, end, "end");

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
        prev_end = (prev_end >= end) ? prev_end - (end - start) : start
      }
    }

    element.selectionStart = prev_start;
    element.selectionEnd = prev_end;
    console.log("prev_end ", prev_end, " prev_start ", prev_start)
    var isFocused = (document.activeElement === element);
    cursors.refresh_mirror(element);

    // if (floatingLabel)   {
    //   floatingLabel.update(element, element.value)
    // }

  },

  generateTypeName: function(element) {
    const { collection, document_id, name } = crud.getAttr(element)

    return crdt.generateID(config.organization_Id, collection, document_id, name);
  },

  setText: function(element_id, info) {
    var pos = 0;
    var flag = true;

    info.forEach(item => {
      if (item.retain) {
        flag = true;
        pos = item.retain;
      }

      if (item.insert || item.delete) {
        if (flag == false) pos = 0;
        flag = false;

        if (item.insert) {
          //. insert process
          this.receiveChangeData(element_id, item.insert, pos, pos)
        }
        else if (item.delete) {
          //. delete process
          this.receiveChangeData(element_id, "", pos, pos + item.delete);
        }

      }
    })
  },

  isAvaiableEl: function(element) {
    //console.log(this.elements)

    for (var i = 0; i < this.elements.length; i++) {
      console.log(this.elements[i].isEqualNode(element), element)
      if (this.elements[i].isEqualNode(element) === true) {
        return true;
      }
    }
    return false;
  },

  sendPosition: function(element) {
    console.log("Se envio ")
    /*if (!this.isAvaiableEl(element)) {
      return;
    }*/

    const id = this.generateTypeName(element);
    //console.log(" SEnd Position Selector ID ",id)
    //console.log(element.selectionStart, element.selectionEnd);
    let from = element.selectionStart;
    let to = element.selectionEnd;
    //console.log("Se envio la position ",id,from, to)
    crdt.setPositionYJS(id, from, to);

  }
}


CoCreateText.init();
// CoCreateInit.register('CoCreateText', CoCreateText, CoCreateText.initElement);

observer.init({
  name: 'CoCreateTextCreate',
	observe: ['addedNodes'],
	target: 'input[data-collection][data-document_id][name], textarea[data-collection][data-document_id][name]',
  callback: function(mutation) {

    // console.log('cocreate-text init')
    		let el = mutation.target;
		el.hasAttribute('data-collection') &&
		el.hasAttribute('data-document_id') &&
		el.hasAttribute('name') &&
    CoCreateText.initElement(mutation.target)
  }
});

observer.init({
  name: 'CoCreateTextNameObserver',
  observe: ['attributes'],
	attributeName: ['data-collection', 'data-document_id', 'name'],
  callback: function(mutation) {
    // console.log('change cocreate-text name')
    		mutation.target.hasAttribute('collection') &&
    		mutation.target.hasAttribute('data-document_id') &&
    		mutation.target.hasAttribute('name') &&
    CoCreateText.refreshElement(mutation)
  }
});

export default CoCreateText;
