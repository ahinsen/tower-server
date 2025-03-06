//import config from './towerSrvCfg.json' assert { type: 'json' };
import { MongoClient } from 'mongodb';
import fetch from 'node-fetch';
import {log, setLogLevel, LOG_LEVELS} from './log.js';
import { promises as fs } from 'fs';
import path from 'path';
// Read and parse the JSON configuration file
const configPath = path.resolve('./towerSrvCfg.json');
const configData = await fs.readFile(configPath, 'utf-8');
const config = JSON.parse(configData);

const ioKey = config.aioCfg.key;
const username = config.aioCfg.username;
setLogLevel(config.logLevel);

// Send unsent items from the value collestion to AdafruitIO
setInterval(sendValue, 2000);
//sendValue();

// Synchronize settings for all feeds TODO: config
const settingFeeds = [
    'P01PRID','P02PRID','P03PRID','P04PRID','P05PRID','P06PRID', 
    'V01TIMER','V02TIMER','V03TIMER','V04TIMER','V05TIMER','V06TIMER'
];
setInterval(() => {
    settingFeeds.forEach(async (feed) => await syncSettings(feed));
}, 10000);
//syncSettings('P01PRID')

async function sendValue() {
    const client = new MongoClient('mongodb://localhost:27017');
    try {
        // Retreive the next item in the values collection to send:
        // the oldest item without an 'aioStatus' property
        await client.connect();
        const db = client.db('iotsrv');
        let collection = db.collection('values');
        const nextValue = await collection.findOne(
            { aioStatus: { $exists: false } },
            { sort: { validAt: 1 } }
        );
        collection = db.collection('log');
        const nextLog = await collection.findOne(
            { aioStatus: { $exists: false } },
            { sort: { timestamp: 1 } }
        );
        let feedKey='';
        let aioObj={};
        let nextItem={};
        // If there is a value to send, send it to AdafruitIO, ...
        if (nextValue || nextLog) {
            // if nexLog is older, or only nextLog exists -> send log
            if (nextValue && nextLog && nextValue.validAt > nextLog.timestamp || !nextValue){
                aioObj = {created_at: new Date(nextLog.timestamp).toISOString(),value: nextLog.logLevel+' '+nextLog.logMsg};
                feedKey = (String(nextLog.deviceId) + 'conn').toLowerCase();  
                nextItem = nextLog;
                log(LOG_LEVELS.DEBUG,`Next item to send (log): ${JSON.stringify(nextLog)} `);
             }                
            // if nexValue is older, or only nextValue exists -> send value
            if (nextValue && nextLog && nextValue.validAt <= nextLog.timestamp || !nextLog){
                aioObj = {created_at: new Date(nextValue.validAt).toISOString(),value: Math.round(nextValue.value*1000)/1000};
                feedKey = (String(nextValue.deviceId) + String(nextValue.valueType)).toLowerCase();
                nextItem = nextValue;
                log(LOG_LEVELS.DEBUG,`Next item to send (value): ${JSON.stringify(nextValue)} `);
                collection = db.collection('values');
            }
            let aioStat = 'sending';
            const url = `https://io.adafruit.com/api/v2/${username}/feeds/${feedKey}/data`;
            log(LOG_LEVELS.DEBUG,`Sending to: ${url} -> ${JSON.stringify(aioObj)}`);
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'X-AIO-Key': ioKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(aioObj) 
            });
            const aioResponse = await response.text();
            if (response.ok) {
                aioStat = 'OK';
                log(LOG_LEVELS.DEBUG, 'Successfully sent to AdafruitIO');
            } else {
                aioStat = 'Error';
                log(LOG_LEVELS.ERROR,'AdafruitIO send error:', aioResponse);
            }
            // ... and update the document in the collection with the AdafruitIO response
            let parsedBody;
            try { parsedBody = JSON.parse(aioResponse); } 
            catch (e) { parsedBody = aioResponse;}
            await collection.updateOne(
                { _id: nextItem._id },
                { $set: { aioResponse: parsedBody, aioStatus: aioStat, at:Date.now()} }
            );
            const savedItem = await collection.findOne({ _id: nextItem._id });
            log(LOG_LEVELS.DEBUG,`Updated ${collection.collectionName} with status: ${savedItem.aioStatus}`);
        }
    } catch (error) {
        log(LOG_LEVELS.ERROR, 'Error sending value to AdafruitIO:', error);
        await client.close();
    }
}

// Synchronize 'settings' collection with new data from Adafruit IO
async function syncSettings(feedKey) {
    const client = new MongoClient(config.dbCfg.uri);
    try {
        await client.connect();
        const db = client.db(config.dbCfg.dbName);
        const collection = db.collection('settings');

        // Step 1: Get the last item in settings based on validAt property
        let lastItem = await collection.findOne(
            { deviceId: { $regex: `^${feedKey.slice(0, 3)}`, $options: 'i' } },
            { sort: { validAt: -1 } }
        );
        if (!lastItem) {
            lastItem = { validAt: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000) }; // 'now' - 6 months
        }
        // Step 2: Get data from Adafruit IO filtered for items older than last item
        const startTime =lastItem.validAt+1000; // Add 1 second to avoid duplicates
        const url = `https://io.adafruit.com/api/v2/${username}/feeds/${feedKey.toLowerCase()}/data?start_time=${new Date(startTime).toISOString()}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-AIO-Key': ioKey,
                'Content-Type': 'application/json'
            }
        });
        const data = await response.json();
        log(LOG_LEVELS.DEBUG, `${feedKey} last item in Setting: ${new Date(lastItem.validAt).toISOString()}, downloaded from aio: ${data.length} items`);
        // Step 3: Insert the received values into the 'settings' collection
        if (Array.isArray(data) && data.length > 0) {
            const transformedData = data.map(item => {
                let name;
                const feedKeyEnding = feedKey.slice(3).toLowerCase();
                if (feedKeyEnding === 'prid') {
                    name = 'prizmId';
                } else if (feedKeyEnding === 'timer') {
                    name = 'timer';
                } else {
                    name = 'unknown';
                }
                return {
                    validAt: new Date(item.created_at).getTime(),
                    validAtISO: item.created_at,
                    deviceId: feedKey.slice(0, 3),
                    name: name,
                    value: item.value,
                    source: 'aioUpdate'
                };
            });
            await collection.insertMany(transformedData);
            log(LOG_LEVELS.DEBUG, feedKey,`Inserted ${data.length} new items into "settings" collection`);
        } else {
            log(LOG_LEVELS.DEBUG, feedKey,'No new data to insert into "settings" collection');
        }
    } catch (error) {
        log(LOG_LEVELS.ERROR, feedKey,'Error synchronizing settings:', error);
    } finally {
        await client.close();
    }
}