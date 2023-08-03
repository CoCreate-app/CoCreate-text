/*globals CustomEvent*/
import action from '@cocreate/actions';
import crud from '@cocreate/crud-client';
import crdt from '@cocreate/crdt';

function save(btn) {
    const { array, object, name, namespace, room, broadcast, broadcastSender, isUpsert } = crud.getAttributes(btn);
    crdt.getText({ array, object, name }).then(response => {
        crud.send({
            method: 'update.object',
            array,
            object: {
                _id: object,
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
    callback: (data) => {
        save(data.element);
    },
});
