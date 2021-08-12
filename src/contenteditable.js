import { getSelections, sendPosition, _dispatchInputEvent } from './index';

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

export default contenteditable;