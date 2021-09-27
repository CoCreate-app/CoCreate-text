let space = "\u{0020}|\u{0009}";
let allAttributeName = `[a-z0-9-_]+?`;

let sps = `(${space})*?`;
let spa = `(${space})+?`;
let tgs = `(?:<(?<tagName>[a-z0-9]+?))`;
let getEndTag = tagName => `(?:<(?<isClosing>${sps}\/${sps})?${tagName}${sps})`;

const idSearch = 'element_id=';
const getRegAttribute = (attributeName) =>
	`(${spa}(?:(?:${attributeName})((?:="[^"]*?")|${space}|>)))`;

let at = getRegAttribute(allAttributeName);

let the = `${sps}(?<tagSlash>\/)?${sps}>`;

let target;
let tagName;
let tagStPos;
let tagStAfPos;
let tagStClPos;
let tagStClAfPos;
let tagEnPos;
let tagEnClAfPos;

export function getDomPosition({ domTextEditor, target, start, end }) {
	target = target.getAttribute('element_id');
// 	let {tagStClAfPos} = findStartTagById(domTextEditor, target);

	if(findStartTagById(domTextEditor, target))
		findClosingTag(domTextEditor, target);
	else return;

	start = tagStClAfPos + start;
	end = tagStClAfPos + end;
	return {start, end};
}

export function getWholeElement(domTextEditor, target) {
	
	if(findStartTagById(domTextEditor, target)) {
		findClosingTag(domTextEditor, target);
		return { start: tagStPos, end: tagEnClAfPos || tagStClAfPos };
	}
	else
		return false;
}

export function findStartTagById(domTextEditor, target) {
	try {
    	let sch = `(?:${sps}element_id\=\"${target}\"${sps})`;
    	let reg = `(?<tagWhole>${tgs}${at}*?${sch}${at}*?${the})`;
    	let tagStart = domTextEditor.htmlString.match(new RegExp(reg, "is"));
    
    	if(!tagStart) return false;
    // 		throw new Error('element is not valid or can not be found');
    
    	tagName = tagStart.groups.tagName.toUpperCase();
    
    	tagStPos = tagStart.index;
    	tagStAfPos = tagStart.index + tagName.length + 1;
    	tagStClPos = tagStart.index + tagStart.groups.tagWhole.length - 1 - (tagStart.groups.tagSlash ? 1 : 0);
    	// haveClosingTag = !tagStart.groups.tagSlash;
    	tagStClAfPos = tagStart.index + tagStart.groups.tagWhole.length;
    // 	tagNameEnd = tagStAfPos + tagName.length;
    	// if it's like <img />
    	if(tagStart.groups.tagSlash) {
    		tagEnPos = tagStClPos;
    		tagEnClAfPos = tagStClAfPos;
    		// isOmission = true; // if the tag doesn't have closing counterpart
    	}
    // 	return true;
    	return {tagName, tagStPos, tagStAfPos, tagStClPos, tagStClAfPos, tagEnPos, tagEnClAfPos};
	} catch {
	    
	}
}

export function findClosingTag(domTextEditor, target) {
	let match = domTextEditor.htmlString.substr(tagStClAfPos)
		.matchAll(new RegExp(`(?<tagWhole>${getEndTag(tagName)}${at}*?${the})`, 'gi'));

	if(!match) throw new Error('can not find any closing tag');

	let nest = 0;

	for(let i of match) {
		if(i.groups.isClosing) {
			if(!nest) {
				tagEnPos = tagStClAfPos + i.index;
				tagEnClAfPos = tagStClAfPos + i.index + i[0].length;
				// return true;
	            return { tagEnPos, tagEnClAfPos };
			}
			else
				nest--;
		}
		else
			nest++;
	}
	throw new Error('closing tag and openning tag order does not match');
}

export function findElByPos(domTextEditor, pos) {
	let pos1 = pos - idSearch.length;
	let pos2 = pos + idSearch.length;

	pos1 = domTextEditor.htmlString.indexOf(idSearch, pos1 + idSearch.length);
	if(pos1 !== -1 && isPosOnEl(domTextEditor, pos1, pos))
		return {target, tagStClAfPos};

	while(true) {
		pos2 = domTextEditor.htmlString.lastIndexOf(idSearch, pos2 - idSearch.length);

		if(pos2 !== -1) {
			if(isPosOnEl(domTextEditor, pos2, pos))
				return {target, tagStClAfPos};
		}
		else return false;
	}

}

function isPosOnEl(domTextEditor, elementIdPos, pos) {
	target = getId(domTextEditor, elementIdPos + idSearch.length);

	if(!findStartTagById(domTextEditor, target))
		return false;

	findClosingTag(domTextEditor, target);
	let tagStartPos = tagStPos;
	let tagEndPos = tagEnClAfPos || tagStClAfPos;

	if(pos > tagStartPos && pos < tagEndPos) {
		return true;
	}
}

function getId(domTextEditor, pos) {
	let attWrapper = domTextEditor.htmlString[pos];
	let endWrapper = domTextEditor.htmlString.indexOf(attWrapper, pos + 1);
	return domTextEditor.htmlString.substring(pos + 1, endWrapper);
}
