String.prototype.customSplice = function(index, absIndex, string) {
    return this.slice(0, index) + string + this.slice(index + Math.abs(absIndex));
};

export function findPosFromString(str, start, end) {
    let response = {};
    let selection = [start];
    // if (start != end) {
    //     selection = [start, end];
    // }
    
    for (let pos of selection) {
        let startString = str.substr(0, pos);
        let endString = str.substr(pos);
        let angleStart = startString.lastIndexOf("<");
        let angleEnd = startString.lastIndexOf(">");
        let endStringAngleEnd = endString.indexOf(">");
        let element, position, nodeStart, nodeEnd, startNode, type;
        if (angleEnd > angleStart) {
            let string = str.customSplice(start, 0, '<findelement></findelement>');
            let newDom = domParser(string);
            let findEl = newDom.querySelector('findelement');
            if (findEl) {
                let insert = getInsertPosition(findEl);
                element = insert.target;
                position = insert.position;
                if (type == 'textNode' || type == 'afterbegin');
                    nodeStart = start - angleEnd - 1;
            }
            findEl.remove()
        }
        else {
            let node = str.slice(angleStart, startString.length + endStringAngleEnd + 1);
            if (node.startsWith("</")) {
                startNode = node.slice(0, 1) + node.slice(2);
                startNode = startNode.substr(0, startNode.length - 1);
                nodeStart = startString.lastIndexOf(startNode);
                let endString1 = str.substr(nodeStart);
                let end = endString1.indexOf(">");
                nodeEnd = nodeStart + end + 1;
                type = 'isEndTag';
            }
            else {
                nodeEnd = startString.length + endStringAngleEnd + 1;
                startNode = node;
                nodeStart = angleStart;
                type = 'isStartTag';
            }
            if (nodeEnd) {
                let string = str.customSplice(nodeEnd - 1, 0, ' findelement');
                let newDom = domParser(string);
                if (newDom.tagName == 'HTML')
                    element = newDom
                else
                    element = newDom.querySelector('[findelement]');
                element.removeAttribute('findelement')
            }
            else {
                let string = str.customSplice(angleStart, 0, '<findelement></findelement>');
                let newDom = domParser(string);
                element = newDom.querySelector('findelement');
                if (element) {
                    let insert = getInsertPosition(element);
                    element = insert.target.parentElement;
                    position = insert.position;
                    if(position == 'afterend')
                        element = element.parentElement;
                    type = 'innerHTML'
                }
                if (!element) {
                    console.log('Could not find element');
                }
            }
        }
        
        if (element) {
            response.element = element;
            response.path = cssPath(element);
            response.position = position;
            response.start = nodeStart;
            response.end = nodeEnd;
            response.type = type || 'insertAdjacent';
        }

    }

    console.log(response);
    return response;
    // findPosFromDom({ str, selector: path, value: 'g' });
}

function getInsertPosition(element){
    let target, position;
    let previousSibling = element.previousSibling;
    let nextSibling = element.nextSibling;
    if (previousSibling || nextSibling) {
        if (!previousSibling) {
            target = element.parentElement;
            position = 'afterbegin';
        }
        else if (!nextSibling) {
            target = element.parentElement;
            position = 'beforend';
        }
        else if (previousSibling && previousSibling.nodeType == 1) {
            target = previousSibling;
            position = 'afterend';
        }
        else if (nextSibling && nextSibling.nodeType == 1) {
            target = nextSibling;
            position = 'beforebegin';
        }
        else {
            target = element.parentElement;
        }
    }
    else {
        target = element.parentElement;
        position = 'afterbegin';
    }
    return {target, position};
}

export function findPosFromDom({ str, selector, target, position, attribute, value }) {
    try {
        let dom = domParser(str);
        let element = dom.querySelector(selector);
        let findEl = document.createElement('findelement');
        if (position) {
            element.insertAdjacentElement(position, findEl);
        }
        if (attribute) {
            element.setAttribute('findelement', '');
        }
        if (value) {
            element.insertAdjacentElement('afterbegin', findEl);
        }
    
        let findElString = dom.innerHTML;
        let pos = findElString.indexOf("<findelement></findelement>");
        let newString = findElString.substr(0, pos);
        let elements = elList(newString, element.tagName)
    
        let start = 0;
        for (let el of elements) {
            let index = str.indexOf(el.tagName.toLowerCase());
            if (index)
                start += index;
        }
        console.log('findindom', start - 1)
    }
    catch (e){
        console.log(e)
    }
}

function elList(str, tagName) {
    let dom = domParser(str);
    let elList = dom.getElementsByTagName(tagName);
    return elList;
}


function cssPath(node) {
    let pathSplits = [];
    do {
        if (!node || !node.tagName) return false;
        let pathSplit = node.tagName.toLowerCase();
        if (node.id) pathSplit += "#" + node.id;

        if (node.classList.length) {
            node.classList.forEach((item) => {
                if (item.indexOf(":") === -1) pathSplit += "." + item;
            });
        }

        if (node.parentNode) {
            let index = Array.prototype.indexOf.call(
                node.parentNode.children,
                node
            );
            pathSplit += `:nth-child(${index + 1})`;
        }

        pathSplits.unshift(pathSplit);
        node = node.parentNode;
    } while (node);

    return pathSplits.join(" > ");
}

export function domParser(str) {
    let mainTag = str.match(/\<(?<tag>[a-z0-9]+)(.*?)?\>/).groups.tag;
    if (!mainTag)
        throw new Error('find position: can not find the main tag');

    let doc;
    switch (mainTag) {
        case 'html':
            doc = new DOMParser().parseFromString(str, "text/html");
            return doc.documentElement;
        case 'body':
            doc = new DOMParser().parseFromString(str, "text/html");
            return doc.body;
        case 'head':
            doc = new DOMParser().parseFromString(str, "text/html");
            return doc.head;

        default:
            let con = document.createElement('div');
            con.innerHTML = str;
            return con;
    }
}

