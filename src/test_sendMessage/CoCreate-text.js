"use strict";


var CoCreateText = {
  elements: [],
  

  init : function() {
    this.initElements(document);
    this.initSockets();
  },
  
  initElements: function(container) {
    var _this = this;
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
      console.log("init ",elements[i])
      elements[i].setAttribute('id',this.generateTypeName(elements[i]));
      this._initEvents(elements[i]);
    }
  },
  
  initSockets: function() {
    let _this = this;
    
    
    CoCreateSocket.listen('Cocreate-text', function(data) {
      console.log('REceived', data);
      let element = document.getElementById(data.pos.id);
      if(element){
        _this.updateChangeData(element, data.content, data.start, data.end)        
      }
      
    });
    
    CoCreateSocket.listen('getDocument', function(data) {
      
      if (!data.metadata || data.metadata.type != "crdt") {
        return;
      }
      _this.elements.forEach((input) => {

  			if (input.crudSetted == true) {
  			  return
  			}

  			const collection = input.getAttribute('data-collection')
  			const id = input.getAttribute('data-document_id')
  			const name = input.getAttribute('name')
  			const data_fetch_value = input.getAttribute('data-fetch_value');
  			
  			if (data_fetch_value === "false" || !CoCreateUtils.isReadValue(input)) return;
  			
  			if (data['collection'] == collection && data['document_id'] == id && (name in data.data)) {
  			 // _this.sendChangeData(input, data['data'][name], 0, data['data'][name].length, false);
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
  
  checkExistElement(element) {
    for (var i = 0; i < this.elements.length; i++) {
      if (this.elements[i].isSameNode(element)) {
        return true;
      }
    }
    return false;
  },
  
  setInitValue(element) {
    var typeId = this.generateTypeName(element);
    var value = CoCreateCrdt.getWholeString(typeId);
    element.value = value;
  },
  
  createYDoc(element) {
    const collection = element.getAttribute('data-collection')
		const document_id = element.getAttribute('data-document_id')
    const status = CoCreate.initDataCrdt({
      collection: collection,
      document_id: document_id,
      name: element.getAttribute('name'),
      element: element,
    })
    
    //. get Crud document

		CoCreate.getDocument({
		  collection: collection,
		  document_id: document_id,
		  metadata: {
		    type: 'crdt'
		  }
		})

    this.elements.push(element)
  },
  
  
  _initEvents: function(input_element) {

    //. selection event
    var _this = this;
    
    input_element.addEventListener('select', function() {
      if (this.selectionEnd !== this.selectionStart) {
        _this.setSelectionInfo(this, true, this.selectionStart, this.selectionEnd)
        
        if(document.activeElement === this)
          _this.sendPosition(this);
      }
    });
    
    input_element.addEventListener('keyup', function(event) {
        let arrows = [37,38,39,40];
        if(arrows.indexOf(event.keyCode)!=-1){
          _this.sendPosition(this);
        }
    });
    
    input_element.addEventListener('keydown', function(event) {
        let arrows = [37,38,39,40];
        console.log(event.keyCode)
        if(arrows.indexOf(event.keyCode)!=-1){
          _this.sendPosition(this);
        }
    });
    
    input_element.addEventListener('click', function(event) {
        if(document.activeElement === this)
          _this.sendPosition(this);
    });
    
    input_element.addEventListener('blur', function(event) {
        const id = _this.generateTypeName(this);
        //CoCreateCrdt.setCursorNull(id);
    });
    
    input_element.addEventListener('input', function(event) {
      let nowstart = this.selectionStart - 1;
      let nowend = nowstart;
      let selection_info = _this.getSelectionInfo(this);
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
          console.log("character_deleted",character_deleted,selection_info.start,selection_info.end)
          
          //recalculate_local_cursors(this,character_deleted)
          
          _this.sendChangeData(this, "", selection_info.start, selection_info.end);
          if (content_text.length > 0) {
            _this.sendChangeData(this, content_text, nowstart, nowend);
          }
          _this.setSelectionInfo(this, false, this.selectionStart, this.selectionStart);
        } else {
          
          _this.sendChangeData(this, content_text, nowstart, nowend);
        }
      }
    })

    /** unselect events **/    
    input_element.addEventListener('blur', function(e) {
      _this.setSelectionInfo(this, false, this.selectionStart, this.selectionStart);
    })
    input_element.addEventListener('click', function(e) {
      _this.setSelectionInfo(this, false, this.selectionStart, this.selectionStart);
    })
    
    /** past events **/
    input_element.addEventListener('paste', function(event) {
      let content_text = event.clipboardData.getData('Text');
      let start = this.selectionStart;
      let end = this.selectionEnd;
      //. send delete event
      if (start != end) {
        this.setSelectionRange(end, end)
        _this.sendChangeData(this, "", start, end, false);
      }
      if(start==end){
        // to calculate Cursors in collaboration 
        // recalculate_local_cursors(this,content_text.length)
      }
      //. insert event
      _this.sendChangeData(this, content_text, start, start, false);
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
            _this.updateChangeData(this, item.insert, pos, pos)
          } else if (item.delete) {
            //. delete process
            _this.updateChangeData(this, "", pos, pos + item.delete);
          }
          
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

console.log("sendChangeData")
    
    const collection = element.getAttribute('data-collection'),
          document_id = element.getAttribute('data-document_id'),
          name = element.getAttribute('name');
    
    
    if (content.length > 0) {
      
      if (isRemove) element.setRangeText("", start, start + content.length, "start")
    
    } else {
      if (isRemove) element.setRangeText(" ".repeat(end - start), start, start, "end")
      
    }

    if(document.activeElement === element)
      {
        let pos = this.sendPosition(element);
        let data = {
          pos:pos,
          element:element,
          content : content, 
          start : start, 
          end : end
        }
        
          //broadcast_sender: true,
          
        CoCreate.sendMessage({
          rooms: [],
          broadcast_sender: true,
          emit: {
            message: 'Cocreate-text',
            data: data
          }
        })
        
      }
  },

  updateChangeData: function(element, content, start, end) {
console.log("Update")
    let prev_start = element.selectionStart;
    let prev_end = element.selectionEnd;
    if(start>end){
       let tmp = start;
      start = end;
      end = tmp;
    }
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
    
    updateFloatLabel(element, element.value)
    
  },

  
  generateTypeName(element) {
    var collection = element.getAttribute('data-collection') || '';
    var document_id = element.getAttribute('data-document_id');
    var name = element.getAttribute('name');
    return name+config.organization_Id+document_id+collection
    //return CoCreateYSocket.generateID(config.organization_Id, collection, document_id, name);
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
    
    
    const id = this.generateTypeName(element);
    console.log(element.selectionStart, element.selectionEnd);
    let from = element.selectionStart;
    let to = element.selectionEnd;
    //CoCreateCrdt.setPositionYJS(id, from, to);
    let data = {
      'id':id,
      'from':from,
      'to':to
    }
    //console.log("SEND DATA ",data)
    //CoCreate.sendMessage(data);
    
    return data;
  }
}


CoCreateText.init();
CoCreateInit.register('CoCreateText', CoCreateText, CoCreateText.initElements);