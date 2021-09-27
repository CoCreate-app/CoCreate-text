

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

		var _range = selection.getRangeAt(0);
		var selected = _range.toString().length;
		var range = _range.cloneRange();
		range.selectNodeContents(element);
		range.setEnd(_range.endContainer, _range.endOffset);
	
		var end = range.toString().length;
		var start = selected ? end - selected : end;

		return { start: start, end: end };
    }
    
}

export function setSelections(element, start, end) {
    if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
        element.selectionStart = start;
        element.selectionEnd = end;
    } 
    else {
    	if (document.activeElement !== element) return;
    
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
