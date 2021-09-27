/*globals Node*/
import { sendPosition, _dispatchInputEvent} from './index.js';
import {getDomPosition} from './textPosition';

export function getSelections (element) {
    if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
        return {
            start: element.selectionStart,
            end: element.selectionEnd
        };
    } 
    else {
		let document = element.ownerDocument;
		var selection = document.getSelection();
		if (!selection.rangeCount) return { start: 0, end: 0 };

		var range = selection.getRangeAt(0);
        var start = range.startOffset;
        var end = range.endOffset;
		if(range.startContainer != range.endContainer) {
    // 		toDo: replace common ancestor value
		}
		let domTextEditor = element;
        let nodePos = getDomPosition({ domTextEditor, target: range.startContainer.parentElement, start, end });
        if (nodePos){
            start = nodePos.start;
            end = nodePos.end;
        }
		return { start, end, range };
    }
    
}

export function processSelections(element, value = "", prev_start, prev_end, start, end, range) {
	if (prev_start >= start) {
		if (value == "") {
			prev_start -= end - start;
			prev_end -= end - start;
			prev_start = prev_start < start ? start : prev_start;
		}
		else {
			prev_start += value.length;
			prev_end += value.length;
		}
	} {
		if (value == "" && prev_end >= start) {
			prev_end = (prev_end >= end) ? prev_end - (end - start) : start;
		}
	}
	setSelections(element, prev_start, prev_end, range);
    _dispatchInputEvent(element, value, start, end, prev_start, prev_end);
}

export function setSelections(element, start, end, range) {
    if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
        element.selectionStart = start;
        element.selectionEnd = end;
    } 
    else {
    // 	if (document.activeElement !== element) return;
    	if (range.commonAncestorContainer) {
    	    let prevElement = range.commonAncestorContainer;
    	    if (prevElement.nodeName == '#text')
    	        prevElement = range.commonAncestorContainer.parentElement;
    	    if (prevElement !== element) return;
    	}
    	let document = element.ownerDocument;
    	var selection = document.getSelection();
    	var range = contenteditable._cloneRangeByPosition(element, start, end);
    	selection.removeAllRanges();
    	selection.addRange(range);
    }
    sendPosition(element);
}


export function hasSelection(el) {
	let { start, end } = getSelections(el);
	if(start != end) {
		return true;
	}
}

const contenteditable = {	
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
