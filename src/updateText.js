import crud from '@cocreate/crud-client';
import crdt from '@cocreate/crdt';
import {getStringPosition} from '@cocreate/selection';


export function insertAdjacentElement({ domTextEditor, target, position, element, elementValue }) {
	let remove;
	if (element && !elementValue) {
		remove = getStringPosition({ string: domTextEditor.htmlString, target: element });
		if(!remove.start && !remove.end)
			throw new Error('insertAdjacentElement: element not found');
		elementValue = domTextEditor.htmlString.substring(remove.start, remove.end);
	}
	
	let	{start} = getStringPosition({ string: domTextEditor.htmlString, target, position, value: elementValue });
	if (remove)
		_updateText({domTextEditor, start: remove.start, end: remove.end});
	if (remove && remove.start < start){
		let length = remove.end - remove.start;
		_updateText({ domTextEditor, value: elementValue, start: start - length});
	}
	else
		_updateText({ domTextEditor, value: elementValue, start});
}

export function removeElement({ domTextEditor, target }) {
	updateDomText({ domTextEditor, target });
}

export function setInnerText({ domTextEditor, target, value, start, end }) {
	updateDomText({ domTextEditor, target, value, pos: {start, end} });
}

export function setClass({ domTextEditor, target, classname }) {
	updateDomText({ domTextEditor, target, attribute: 'class', value: classname });
}

export function setClassStyle({ domTextEditor, target, classname, value, unit }) {
	updateDomText({ domTextEditor, target, attribute: 'class', value: `${classname}:${value}${unit}` });
}

export function setStyle({ domTextEditor, target, styleName }) {
	updateDomText({ domTextEditor, target, attribute: 'style', value: styleName });
}

export function setAttribute({ domTextEditor, target, name, value }) {
	updateDomText({ domTextEditor, target, attribute: name, value });
}

export function removeAttribute({ domTextEditor, target, name }) {
	updateDomText({ domTextEditor, target, attribute: name, removeAttribute: 'true'});
}

export function replaceInnerText({ domTextEditor, target, value }) {
	updateDomText({ domTextEditor, target, value });
}

export function updateDomText({ domTextEditor, target, position, element, elementValue, attribute, value, pos, removeAttribute }) {
	let	{start, end, newValue} = getStringPosition({ string: domTextEditor.htmlString, target, attribute, value });
	if (pos){
		start += pos.start;
		end += pos.end;
	}
	if(start != end)
		_updateText({domTextEditor, start, end});
	if(attribute && removeAttribute != 'true')
		_updateText({ domTextEditor, value: ` ${attribute}="${newValue}"`, start });
	else if(value)
		_updateText({ domTextEditor, value, start });
}

function _updateText({ domTextEditor, value, start, end}) {
    if(domTextEditor.tagName =='HTML')
        domTextEditor = domTextEditor.ownerDocument.defaultView.frameElement;
    const { collection, document_id, name, isCrud } = crud.getAttr(domTextEditor);
	crdt.updateText({ collection, document_id, name, value, start, length: end - start, crud: isCrud });
}
