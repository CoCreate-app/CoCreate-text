/*globals CustomEvent*/
import action from '@cocreate/action';
import crud from '@cocreate/crud-client';
import crdt from '@cocreate/crdt';

function save(btn){
	const { collection, document_id, name, namespace, room, isBroadcast, isBroadcastSender, isUpsert} = crud.getAttr(btn);
	let data = crdt.getText({collection, document_id, name});
	crud.updateDocument({
		collection: collection,
		document_id: document_id,
		data: {
			[name]: data
		},
		upsert: isUpsert,
		namespace: namespace,
		room: room,
		broadcast: isBroadcast,
		broadcast_sender: isBroadcastSender
	});
	
	document.dispatchEvent(new CustomEvent('savedDomText'));
}

action.init({
	action: "saveDomText",
	endEvent: "savedDomText",
	callback: (btn, data) => {
		save(btn);
	},
});