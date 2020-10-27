"use strict";

var CoCreateText = {
  elements: [],
  
  init : function() {
    this.initElement(document);
    // this.initSockets();
  },
  
  initElement: function(container) {
    var self = this;
    let fetch_container = container || document;
    
    let elements = fetch_container.querySelectorAll('input[data-document_id][name], textarea[data-document_id][name]');
    if (elements.length == 0 && 
        fetch_container != document &&
        fetch_container.hasAttribute('data-document_id') && 
        fetch_container.hasAttribute('name')) 
    {
      elements = [fetch_container];
    }

    for (var i = 0; i < elements.length; i++) {
      // CoCreateUtils.disableAutoFill(elements[i])
      if (!CoCreateInput.isUsageY(elements[i])) {
        continue;
      }
      
      if (this.checkExistElement(elements[i])) {
        // this.setInitValue(elements[i])
        continue;
      }
      
			if (CoCreateInit.getInitialized(elements[i])) {
				continue;
			}
			CoCreateInit.setInitialized(elements[i]);
      
      this.__initEvents(elements[i]);
      
      if (CoCreateDocument.checkID(elements[i])) {
        this.createYDoc(elements[i]);

      } else {
        //. register create document_id event
        elements[i].addEventListener('set-document_id', function(event) {
          var el = this;
          var text_str = el.value;

          self.createYDoc(el);
          self.sendChangeData(el, text_str, 0, text_str.length);
        })
      }
    }
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
    var value = CoCreateCrdt.getWholeString(typeId);
    element.value = value;
  },
  
  createYDoc: function(element) {
    const collection = element.getAttribute('data-collection')
		const document_id = element.getAttribute('data-document_id')
    const status = CoCreate.initDataCrdt({
      collection: collection,
      document_id: document_id,
      name: element.getAttribute('name'),
      element: element,
    })
    
    //. get Crud document

		// CoCreate.readDocument({
		//   collection: collection,
		//   document_id: document_id,
		//   metadata: {
		//     type: 'crdt'
		//   }
		// })

    this.elements.push(element)
  },
  
  
  __initEvents: function(input_element) {

    //. selection event
    const self = this;
    
    input_element.addEventListener('select', function() {
      if (this.selectionEnd !== this.selectionStart) {
        self.setSelectionInfo(this, true, this.selectionStart, this.selectionEnd)
        
        if(document.activeElement === this)
          self.sendPosition(this);
      }
    });
    
    input_element.addEventListener('keyup', function(event) {
        let arrows = [37,38,39,40];
        if(arrows.indexOf(event.keyCode)!=-1){
          self.sendPosition(this);
        }
    });
    
    input_element.addEventListener('keydown', function(event) {
        let arrows = [37,38,39,40];
        if(arrows.indexOf(event.keyCode)!=-1){
          console.log("keydown")
          self.sendPosition(this);
        }
    });
    
    input_element.addEventListener('click', function(event) {
        if(document.activeElement === this)
          self.sendPosition(this);
    });
    
    input_element.addEventListener('blur', function(event) {
        const id = self.generateTypeName(this);
        CoCreateCrdt.setCursorNull(id);
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
          nowstart ++;
          nowend = nowstart + 1;
          break;
        case 'deleteContentForward':
          isUpdate = true;
          nowstart ++;
          nowend = nowstart + 1;
          break;
        case 'insertLineBreak':
          isUpdate = true;
          content_text = "\n";
          nowend ++;
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
          
          //recalculate_local_cursors(this,character_deleted)
          
          self.sendChangeData(this, "", selection_info.start, selection_info.end);
          if (content_text.length > 0) {
            self.sendChangeData(this, content_text, nowstart, nowend);
          }
          self.setSelectionInfo(this, false, this.selectionStart, this.selectionStart);
        } else {
          
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
      let content_text = event.clipboardData.getData('Text');
      let start = this.selectionStart;
      let end = this.selectionEnd;
      //. send delete event
      if (start != end) {
        this.setSelectionRange(end, end)
        self.sendChangeData(this, "", start, end, false);
      }
      if(start==end){
        // to calculate Cursors in collaboration 
        // recalculate_local_cursors(this,content_text.length)
      }
      //. insert event
      self.sendChangeData(this, content_text, start, start, false);
      event.preventDefault()
    })
    
    input_element.addEventListener('cocreate-y-update', function(event) {
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
          } else if (item.delete) {
            //. delete process
            self.updateChangeData(this, "", pos, pos + item.delete);
          }
          
        }
      })
    })
  },
  
  __initSockets: function() {
    const self = this;
    CoCreateSocket.listen('readDocument', function(data) {
      
      if (!data.metadata || data.metadata.type != "crdt") {
        return;
      }
      self.elements.forEach((input) => {

  			if (input.crudSetted == true) {
  			  return
  			}

  			const collection = input.getAttribute('data-collection')
  			const id = input.getAttribute('data-document_id')
  			const name = input.getAttribute('name')
  			const data_fetch_value = input.getAttribute('data-fetch_value');
  			
  			if (data_fetch_value === "false" || !CoCreateUtils.isReadValue(input)) return;
  			
  			if (data['collection'] == collection && data['document_id'] == id && (name in data.data)) {
  			 // self.sendChangeData(input, data['data'][name], 0, data['data'][name].length, false);
  			  CoCreate.replaceDataCrdt({
  			    collection: collection,
  			    document_id: id,
  			    name: name,
  			    value: data['data'][name],
  			  })
  			  input.crudSetted = true;
  			}
  		})
    })
  },
  
  setSelectionInfo:function(e, isSelect, start, end) {
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
      end:parseInt(e.getAttribute("selection_end"))
    }
  },
  
  checkDocumentID: function(element) {
    let document_id = element.getAttribute('data-document_id');
    if (!document_id || document_id === "") {
      return false;
    }
    
    return true;
  },
  
  sendChangeData: function(element, content, start, end, isRemove = true) {

    if (!this.checkDocumentID(element)) {
      CoCreateDocument.requestDocumentId(element)
      element.setAttribute('data-document_id', 'pending');
      return ;
    }
    
    if (element.getAttribute('data-document_id') == 'pending') {
      return;
    }
    
    const collection = element.getAttribute('data-collection'),
          document_id = element.getAttribute('data-document_id'),
          name = element.getAttribute('name');
    
    if (element.getAttribute('data-save_value') == 'false') {
      return;
    }
    console.log(" Remove ",isRemove)
    console.log(" tart ",start)
    console.log(" end ",end)
    console.log(" content.length ",content.length)
    console.log(" content ",content)
    
    let character_count = content.length > 0 ? content.length : -1;
    recalculate_local_cursors(element,character_count);
    
      //send position when keyUp 
      this.sendPosition(element)
    if (content.length > 0) {
      if (isRemove) element.setRangeText("", start, start + content.length, "start")
      CoCreate.insertDataCrdt({
        collection, document_id, name,
        value: content,
        position: start
      })
    } else {
      if (isRemove) element.setRangeText(" ".repeat(end - start), start, start, "end")
      CoCreate.deleteDataCrdt({
        collection, document_id, name,
        position: start,
        length: end - start,
      })
    }

    if(document.activeElement === element)
      this.sendPosition(element);
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
      } else {
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

    var isFocused = (document.activeElement === element);
    refresh_mirror(element);
    
    if (CoCreateFloatLabel)   {
      CoCreateFloatLabel.update(element, element.value)
    }

  },
  
  generateTypeName: function(element) {
    var collection = element.getAttribute('data-collection');
    var document_id = element.getAttribute('data-document_id');
    var name = element.getAttribute('name');
    
    return CoCreateYSocket.generateID(config.organization_Id, collection, document_id, name);
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
        } else if (item.delete) {
          //. delete process
          this.receiveChangeData(element_id, "", pos, pos + item.delete);
        }
        
      }
    })
  },
  
  isAvaiableEl: function(element) {
    for (var  i = 0; i < this.elements.length; i++) {
      if (this.elements[i].isEqualNode(element)) {
        return true;
      }
    }
    return false;
  },
  
  sendPosition: function(element) {
    if (!this.isAvaiableEl(element)) {
      return;
    }
    
    const id = this.generateTypeName(element);
    //console.log(" SEnd Position Selector ID ",id)
    console.log(element.selectionStart, element.selectionEnd);
    let from = element.selectionStart;
    let to = element.selectionEnd;
    CoCreateCrdt.setPositionYJS(id, from, to);
    
  }
}


CoCreateText.init();
CoCreateInit.register('CoCreateText', CoCreateText, CoCreateText.initElement);