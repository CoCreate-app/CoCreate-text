/*globals CustomEvent*/
import action from '@cocreate/actions';
import crud from '@cocreate/crud-client';
import crdt from '@cocreate/crdt';
import { getAttributes } from '@cocreate/utils';

function save(btn) {
    const { array, object, key, namespace, room, broadcast, broadcastSender, isUpsert } = getAttributes(btn);
    crdt.getText({ array, object, key }).then(response => {
        crud.send({
            method: 'update.object',
            array,
            object: {
                _id: object,
                [key]: response
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
