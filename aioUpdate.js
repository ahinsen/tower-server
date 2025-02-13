import { MongoClient } from 'mongodb';
//const { MongoClient } = require('mongodb');

// ...existing code...

async function nextValue() {
    const client = new MongoClient('mongodb://localhost:27017');
    try {
        await client.connect();
        const db = client.db('iotsrv');
        const collection = db.collection('values');
        const document = await collection.findOne({
            $or: [
                { AIOstatus: { $exists: false } },
                { AIOstatus: { $ne: 'success' } }
            ]
        }, { sort: { receivedAt: 1 } });
        return document;
    } finally {
        await client.close();
    }
}

setInterval(async () => {
    const doc = await nextValue();
    if (doc) {
        console.log('Next value to send:', doc);
        // ...code to send the document to AdafruitIO...
    }
}, 1000);

// ...existing code...
