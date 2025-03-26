import { on } from 'events';
import { MongoClient } from 'mongodb';
import { start } from 'repl';
/*import path from 'path';
import { promises as fs } from 'fs';

const dbUri = "mongodb://127.0.0.1:27017/?directConnection=true&serverSelectionTimeoutMS=20000";
const dbName = 'iotsrv';

async function executeAggregation(collectionName, aggregationFile) {
    const client = new MongoClient(dbUri);
    try {
        await client.connect();
        const database = client.db(dbName);
        const collection = database.collection(collectionName);

        const aggregationPath = path.resolve('db/aggregations', aggregationFile);
        const { default: pipeline } = await import(aggregationPath);

        const result = await collection.aggregate(pipeline).toArray();
        console.log('Aggregation result:', result);
    } catch (error) {
        console.error('Error executing aggregation:', error);
    } finally {
        await client.close();
    }
}


const { MongoClient } = require('mongodb');
*/
async function runAggregation() {
    const dbUri = "mongodb://127.0.0.1:27017/?directConnection=true&serverSelectionTimeoutMS=20000";
    const dbName = 'iotsrv';
    const client = new MongoClient(dbUri);

    try {
        await client.connect();
        const database = client.db(dbName);
        const valuesCollection = database.collection('values');

/*        const now = new Date();
        let yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        yesterday= yesterday.getTime();
        const yesterdayNoon = yesterday + 12 * 60 * 60 * 1000;
        const yesterdayMidnight = yesterday + 24 * 60 * 60 * 1000;
*/        
        const now = new Date();
        let today = new Date(now);
        today.setHours(0, 0, 0, 0);
        const endTime = today.getTime();
        const startTime = endTime - 24 * 60 * 60 * 1000;

        const pipeline = [
            {
                $match: {
                    validAt: {
                        $gte: startTime,   
                        $lt: endTime
                    }
                }
            },
            {
                $group: {
                    _id: { deviceId: "$deviceId", valueType: "$valueType" },
                    avgValue: { $avg: "$value" }
                }
            },
            {
                $project: {
                    _id: 0,
                    itemType: "dailyAvg",
                    receivedAt: now,
                    deviceId: "$_id.deviceId",
                    valueType: "$_id.valueType",
                    validAt: startTime + 12*60*60*1000,
                    value: "$avgValue"
                }
            },
            {
                $merge: {
                    into: "values",
                    on: ["deviceId", "valueType", "validAt"],
                    whenMatched: "merge",
                    whenNotMatched: "insert"
                }
            }
        ];

        const result = await valuesCollection.aggregate(pipeline).toArray();
        console.log('Aggregation result:', result);
    } catch (error) {
        console.error('Error running aggregation:', error);
    } finally {
        await client.close();
    }
}
console.log('running Aggregation ');

runAggregation();

//export { executeAggregation };