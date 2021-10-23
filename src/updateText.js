import crud from '@cocreate/crud-client';
import crdt from '@cocreate/crdt';
import {getPosFromDom, domParser} from './findElement';

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
	if (element) {
		remove = getPosFromDom({ string: domTextEditor.htmlString, target: element });
	}
	
	let	{start, end} = getPosFromDom({ string: domTextEditor.htmlString, target, position, value: elementValue });
	if(!elementValue) {
		if(!start && !end)
			throw new Error('insertAdjacentElement: element not found');
		elementValue = domTextEditor.htmlString.substring(start, end);
	}
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
	let	{start, end} = getPosFromDom({ string: domTextEditor.htmlString, target});
	if(!start && !end)
		throw new Error('removeElement: element not found');
		
	removeCallback({domTextEditor, start, end});
}

export function setClass({ domTextEditor, target, classname }) {
	let	{start, end, value} = getPosFromDom({ string: domTextEditor.htmlString, target, value: classname });
	if(end)
		removeCallback({domTextEditor, start, end});
	addCallback({ domTextEditor, start, value: ` class="${value}"` });
}

export function setClassStyle({ domTextEditor, target, classname, value, unit }) {
	value = `${classname}:${value}${unit}`
	let	{start, end, val} = getPosFromDom({ string: domTextEditor.htmlString, target, value: classname });
	if(end)
		removeCallback({domTextEditor, start, end});
	addCallback({ domTextEditor, start, value: ` class="${val}"` });
}

export function setStyle({ domTextEditor, target, styleName }) {
	let	{start, end, value} = getPosFromDom({ string: domTextEditor.htmlString, target, attribute: 'style', value: styleName });
	if(end)
		removeCallback({domTextEditor, start, end});
	addCallback({ domTextEditor, start, value: ` style="${value}"` });
}

export function setAttribute({ domTextEditor, target, name, value }) {
	let	{start, end, val} = getPosFromDom({ string: domTextEditor.htmlString, target, attribute: name, value: value });
	if(end)
		removeCallback({domTextEditor, start, end});
	addCallback({ domTextEditor, start, value: ` ${name}="${val}"` });
}

export function removeAttribute({ domTextEditor, target, name }) {
	let	{start, end, val} = getPosFromDom({ string: domTextEditor.htmlString, target, attribute: name });
	if(end)
		removeCallback({domTextEditor, start, end});
}

export function setInnerText({ domTextEditor, target, value, start, end }) {
	let	element = getPosFromDom({ string: domTextEditor.htmlString, target });
	if(start != end)
		removeCallback({ domTextEditor, start: start + element.start, end: end + element.end });
	if(value)
		addCallback({ domTextEditor, start: start + element.start, value });
}

export function replaceInnerText({ domTextEditor, target, value }) {
	let	{start, end} = getPosFromDom({ string: domTextEditor.htmlString, target });
	if(start != end)
		removeCallback({ domTextEditor, start, end });
	if(value)
		addCallback({ domTextEditor, start, value });
}
