import observer from '@cocreate/observer'
import crud from '@cocreate/crud-client'
import crdt from '@cocreate/crdt'
import cursors from '@cocreate/cursors'
import form from '@cocreate/form'
import { logger } from '@cocreate/utils'

let console = logger('off');

const CoCreateText = {

	selector: "input[data-collection][data-document_id][name], textarea[data-collection][data-document_id][name]",

	init: function() {
		let elements = document.querySelectorAll(this.selector);
		this.initElements(elements);
	},
	
	initElements: function(elements) {
		for (let element of elements)
			this.initElement(element);
	},
	
	initElement: function(element, data) {
    if( element.tagName === "INPUT" &&  ["text", "email", "tel", "url"].includes(element.type) || element.tagName === "TEXTAREA"){
  		const {collection, document_id, name, is_realtime} = crud.getAttr(element);
  		if (!document_id || !is_realtime) return;
  	
  		if (document_id == 'pending') {
        return;
      }
      
      element.setAttribute('crdt', 'true')
      
      this.__initEvents(element);
     
      this.createDoc(element);
      
      this.setValue(element)
    }
	},
	
	createDoc: function(element) {
    const { collection, document_id, name } = crud.getAttr(element)
    if (!crud.checkAttrValue(collection) || !crud.checkAttrValue(document_id) || !crud.checkAttrValue(name)) return;
    
  //   crdt.init({ collection, document_id, name, element }).then(data => {
  //     element.value = crdt.getText({ collection, document_id, name })
  //   }).catch(err => {
		// 		console.error(err)
		// })
    crdt.init({ collection, document_id, name, element })
	},
	
	setValue: function(element) {
    var typeId = this.generateTypeName(element);
    const { collection, document_id, name } = crud.getAttr(element)
    element.value = crdt.getText({ collection, document_id, name })
  },
  
  generateTypeName: function(element) {
    const { collection, document_id, name } = crud.getAttr(element)
    return crdt.generateID(config.organization_Id, collection, document_id, name);
  },

  __initEvents: function(element) {

    //. selection event
    const self = this;

    element.addEventListener('select', function() {
      if (this.selectionEnd !== this.selectionStart) {
        self.setSelectionInfo(this, true, this.selectionStart, this.selectionEnd)

        if (document.activeElement === this)
          self.sendPosition(this);
      }
    });

    element.addEventListener('keyup', function(event) {
      let arrows = [37, 38, 39, 40];
      if (arrows.indexOf(event.keyCode) != -1) {
        self.sendPosition(this);
      }
    });

    element.addEventListener('keydown', function(event) {
      let arrows = [37, 38, 39, 40];
      if (arrows.indexOf(event.keyCode) != -1) {
        //console.log("keydown ---- ")
        self.sendPosition(this);
      }
    });

    element.addEventListener('click', function(event) {
      if (document.activeElement === this)
        self.sendPosition(this);
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
    element.addEventListener('blur', function(e) {
      self.setSelectionInfo(this, false, this.selectionStart, this.selectionStart);
    })
    element.addEventListener('click', function(e) {
      self.setSelectionInfo(this, false, this.selectionStart, this.selectionStart);
    })

    /** past events **/
    element.addEventListener('paste', function(event) {
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

    element.addEventListener('cocreate-crdt-update', function(event) {
      var info = event.detail;
      element.crudSetted = true;

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
  
  sendPosition: function(element) {
    const { collection, document_id, name } = crud.getAttr(element)
    const id = this.generateTypeName(element);
    let from = element.selectionStart;
    let to = element.selectionEnd;
    crdt.setPositionYJS(id, from, to);
    // ToDo: use sendPosition
    // crdt.sendPosition(collection, document_id, name, from, to);
  },

  sendChangeData: function(element, content, start, end, isRemove = true) {
    const { collection, document_id, name } = crud.getAttr(element)
    const isCrud = element.getAttribute('data-crud') == "false" ? false : true;

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

  },

}


CoCreateText.init();


observer.init({
  name: 'CoCreateTextAddedNodes',
	observe: ['addedNodes'],
	target: 'input[data-collection][data-document_id][name], textarea[data-collection][data-document_id][name]',
  callback: function(mutation) {
    CoCreateText.initElement(mutation.addedNodes)
  }
});

observer.init({
  name: 'CoCreateTextAttribtes',
  observe: ['attributes'],
	attributeName: ['data-collection', 'data-document_id', 'name'],
  callback: function(mutation) {
    CoCreateText.initElement(mutation.target)
  }
});

export default CoCreateText;
