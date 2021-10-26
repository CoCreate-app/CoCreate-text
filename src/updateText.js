import crud from '@cocreate/crud-client';
import crdt from '@cocreate/crdt';
import {getStringPosition} from '@cocreate/selection';

function removeCallback(param) {
	if(!param) return;
	let domTextEditor = param.domTextEditor;
    if(domTextEditor.tagName =='HTML')
        domTextEditor = domTextEditor.ownerDocument.defaultView.frameElement;
    const { collection, document_id, name, isCrud } = crud.getAttr(domTextEditor);
	crdt.deleteText({
		collection,
		document_id,
		name,
		crud: isCrud,
		start: param.start,
		length: param.end - param.start,
	});

}

function addCallback(param) {
	if(!param) return;
	let domTextEditor = param.domTextEditor;
    if(domTextEditor.tagName =='HTML')
        domTextEditor = domTextEditor.ownerDocument.defaultView.frameElement;
    const { collection, document_id, name, isCrud } = crud.getAttr(domTextEditor);
	crdt.insertText({
		collection,
		document_id,
		name,
		value: param.value,
		start:  param.start,
		crud: isCrud,
	});
}

export function insertAdjacentElement({ domTextEditor, target, position, element, elementValue }) {
	let remove
	if (element && !elementValue) {
		remove = getStringPosition({ string: domTextEditor.htmlString, target: element });
	}
	if(!elementValue) {
		if(!remove.start && !remove.end)
			throw new Error('insertAdjacentElement: element not found');
		elementValue = domTextEditor.htmlString.substring(remove.start, remove.end);
		// elementValue = remove.newValue;
	}
	let	{start} = getStringPosition({ string: domTextEditor.htmlString, target, position, value: elementValue });
	if (remove){
		removeCallback({domTextEditor, start: remove.start, end: remove.end});
		if (remove.start < start){
			let length = remove.end - remove.start;
			addCallback({ domTextEditor, value: elementValue, start: start - length});
		}
		else
			addCallback({ domTextEditor, value: elementValue, start});
	}
	else
		addCallback({ domTextEditor, value: elementValue, start});
}

export function removeElement({ domTextEditor, target }) {
	let	{start, end} = getStringPosition({ string: domTextEditor.htmlString, target});
	if(!start && !end)
		throw new Error('removeElement: element not found');
		
	removeCallback({domTextEditor, start, end});
}

export function removeAttribute({ domTextEditor, target, name }) {
	let	{start, end} = getStringPosition({ string: domTextEditor.htmlString, target, attribute: name });
	if(end)
		removeCallback({domTextEditor, start, end});
}

export function setInnerText({ domTextEditor, target, value, start, end }) {
	let	element = getStringPosition({ string: domTextEditor.htmlString, target });
	if(start != end)
		removeCallback({ domTextEditor, start: start + element.start, end: end + element.end });
	if(value)
		addCallback({ domTextEditor, start: start + element.start, value });
}

			export function setClass({ domTextEditor, target, classname }) {
				let	{start, end, value} = getStringPosition({ string: domTextEditor.htmlString, target, value: classname });
				if(end)
					removeCallback({domTextEditor, start, end});
				addCallback({ domTextEditor, start, value: ` class="${value}"` });
			}
			
			export function setClassStyle({ domTextEditor, target, classname, value, unit }) {
				value = `${classname}:${value}${unit}`;
				let	{start, end, newValue} = getStringPosition({ string: domTextEditor.htmlString, target, attribute: 'class', value });
				if(end)
					removeCallback({domTextEditor, start, end});
				addCallback({ domTextEditor, start, value: ` class="${newValue}"` });
			}
			
			export function setStyle({ domTextEditor, target, styleName }) {
				let	{start, end, value} = getStringPosition({ string: domTextEditor.htmlString, target, attribute: 'style', value: styleName });
				if(end)
					removeCallback({domTextEditor, start, end});
				addCallback({ domTextEditor, start, value: ` style="${value}"` });
			}
			
			export function setAttribute({ domTextEditor, target, name, value }) {
				let	{start, end, newValue} = getStringPosition({ string: domTextEditor.htmlString, target, attribute: name, value: value });
				if(end)
					removeCallback({domTextEditor, start, end});
				addCallback({ domTextEditor, start, value: ` ${name}="${newValue}"` });
			}



			export function replaceInnerText({ domTextEditor, target, value }) {
				let	{start, end} = getStringPosition({ string: domTextEditor.htmlString, target });
				if(start != end)
					removeCallback({ domTextEditor, start, end });
				if(value)
					addCallback({ domTextEditor, start, value });
			}

export function updateDomText({ domTextEditor, target, position, element, elementValue, attribute, value }) {
	let	{start, end, newValue} = getStringPosition({ string: domTextEditor.htmlString, target, attribute, value });
	if(start != end)
		removeCallback({domTextEditor, start, end});
	if(attribute)
		addCallback({ domTextEditor, start, value: ` ${attribute}="${newValue}"` });
	else if(value)
		addCallback({ domTextEditor, start, value });
}
