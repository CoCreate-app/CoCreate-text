/*globals Node*/
import {getSelections, processSelections,  _dispatchInputEvent} from './index.js';

const contenteditable = {	
	_insertElementText: function(element, content, position) {
		if (!content || content === '') return;
		var curCaret = getSelections(element);
		
        // if (!element.domText){
		    var selection = window.getSelection();
    		var range = this._cloneRangeByPosition(element, position, position);
    		var tmp = document.createElement("div");
    		var frag = document.createDocumentFragment(),
    			node;
    
    		tmp.innerHTML = content;
    
    		while ((node = tmp.firstChild)) {
    			frag.appendChild(node);
    		}
    		range.insertNode(frag);
        // }


		if (!curCaret) {
			// let curCaret = {start: 0, end: 0}
			
			selection.addRange(range);
			selection.removeRange(range);
			return;
		}

		processSelections(element, content, curCaret.start, curCaret.end, position, position);
	},

	_deleteElementText: function(element, start, end) {
		var content_length = end - start;
		if (!content_length) return;
	
		var curCaret = getSelections(element);
// 		if (!element.domText){
    		var selection = window.getSelection();
    		var range = this._cloneRangeByPosition(element, start, end);
    		if (range) range.deleteContents();
// 		}

		if (!curCaret) {
			selection.removeRange(range);
			return;
		}

		processSelections(element, "", curCaret.start, curCaret.end, start, end);
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


export {contenteditable};