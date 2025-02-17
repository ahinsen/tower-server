import config from './towerSrvCfg.json' assert { type: 'json' };
import { MongoClient } from 'mongodb';
import fetch from 'node-fetch';
import {log, setLogLevel, LOG_LEVELS} from './log.js';

const ioKey = config.aioCfg.key;
const username = config.aioCfg.username;
setLogLevel(config.logLevel);

// Return the next "value" document that has not been sent to AdafruitIO
async function nextValue() {
    const client = new MongoClient('mongodb://localhost:27017');
    try {
        await client.connect();
        const db = client.db('iotsrv');
        const collection = db.collection('values');
        const document = await collection.findOne(
            { aioStatus: { $exists: false } },
            { sort: { validAt: 1 } }
        );
        return document;
    } finally {
        await client.close();
    }
}

async function sendToAdafruitIO(value, ioKey, username, feedKey) {
    const url = `https://io.adafruit.com/api/v2/${username}/feeds/${feedKey}/data`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'X-AIO-Key': ioKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ value }) 
    });
    const responseBody = await response.text();
    return { ok: response.ok, body: responseBody };
}


async function sendValue() {
    const doc = await nextValue();
    if (doc) {
        const validAtStr = secondsToISO('2000-01-01', Math.round(doc.validAt));
        const aioObj = {created_at: validAtStr,value: Math.round(doc.value*1000)/1000};
        const feedKey = (doc.deviceId + doc.sensorId).toLowerCase();
        let aioStat = 'sending';
        log(LOG_LEVELS.DEBUG,`Next value to send: ${JSON.stringify(doc)} -> ${JSON.stringify(aioObj)}`);
        const result = await sendToAdafruitIO(aioObj.value, ioKey, username, feedKey);
        if (result.ok) {
            aioStat = 'OK';
            log(LOG_LEVELS.DEBUG, 'Successfully sent to AdafruitIO');
        } else {
            aioStat = 'Error';
            log(LOG_LEVELS.ERROR,'AdafruitIO send error:', result.body);
        }
        const client = new MongoClient('mongodb://localhost:27017');
        try {
            await client.connect();
            const db = client.db('iotsrv');
            const collection = db.collection('values');
            let parsedBody;
            try { parsedBody = JSON.parse(result.body); } 
            catch (e) { parsedBody = result.body;}
            await collection.updateOne(
                { _id: doc._id },
                { $set: { aioResponse: parsedBody, aioStatus: aioStat } }
            );
        } finally {
            await client.close();
        }
    }
}

// Convert seconds since a base date (e.g. 2000-01-01) to an ISO date string
function secondsToISO(base, seconds) {
    const baseDate = new Date(base);
    const targetDate = new Date(baseDate.getTime() + seconds * 1000);
    // Manually format the date to omit fractional seconds
    const isoString = targetDate.toISOString();
    return isoString.split('.')[0] + 'Z';
}

setInterval(sendValue, 1000);
//sendValue();