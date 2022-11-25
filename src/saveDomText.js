/*globals CustomEvent*/
import action from '@cocreate/actions';
import crud from '@cocreate/crud-client';
import crdt from '@cocreate/crdt';

function save(btn){
	const { collection, document_id, name, namespace, room, broadcast, broadcastSender, isUpsert} = crud.getAttributes(btn);
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
