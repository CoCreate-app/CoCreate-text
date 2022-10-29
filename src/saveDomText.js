/*globals CustomEvent*/
import action from '@cocreate/actions';
import CRUD from '@cocreate/crud-client';
import crdt from '@cocreate/crdt';

let crud
if(CRUD && CRUD.default)
	crud = CRUD.default
else
	crud = CRUD

function save(btn){
	const { collection, document_id, name, namespace, room, broadcast, broadcastSender, isUpsert} = crud.getAttr(btn);
	crdt.getText({collection, document_id, name}).then(response => {
		crud.updateDocument({
			collection,
			document: {
				_id: document_id,
				[name]: response
			},
			upsert: isUpsert,
			namespace,
			room,
			broadcast,
			broadcastSender
		});
		
		document.dispatchEvent(new CustomEvent('savedDomText'));
	});
}

action.init({
	name: "saveDomText",
	endEvent: "savedDomText",
	callback: (btn, data) => {
		save(btn);
	},
});
