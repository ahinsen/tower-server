/* Listen to, and process HTTP  calls:
- HTTP POST requests will be written to the db
- HTTP GET requests will return the result of a query
check log using journalctl -u iotsrv.service
*/
// Read and validate config properties


import config from './towerSrvCfg.json' assert { type: 'json' };
import { MongoClient } from 'mongodb';
import { createServer } from 'http';
import { LOG_LEVELS, setLogLevel, log } from './log.js';

let dbClient;
let httpServer;

startServer();

// processing the http request
const httpListener = async function(req, res) {
	let data = '';
	let result = [""];
	req.on('data', chunk => data += chunk.toString());
	req.on('end', async () => {
		try {
			log(LOG_LEVELS.DEBUG,'Request Headers:', req.headers);
			log(LOG_LEVELS.DEBUG,'Request Method:', req.method);
			log(LOG_LEVELS.DEBUG,'Request URL:', req.url);
			log(LOG_LEVELS.DEBUG,'Data:', data);
			if (req.method === 'POST') {
				if (await writeToDb(data)) httpResponse(res,200,"success");
				else                       httpResponse(res,500,'db write error');
			} else if (req.method === 'GET') {
				if(await readFromDb(data,result)) httpResponse(res,200,"success");
				else                              httpResponse(res,400,result[0]);
			} else httpResponse(res,400,"Unsupported request method:",req.method);
		} catch (error) {
			httpResponse(res,500, "Error during processing request(end)", error.message);
		}
	});
	req.on('error', (err) => {log(LOG_LEVELS.ERROR, "Error during processing request(error)", err);});
	//req.on('close', () => {httpResponse(res,500, "Request closed before completion"+data);}); 
};

// Generating the http response
async function httpResponse(res, code, message) {
	if (!res.headersSent) {
		log(LOG_LEVELS.DEBUG,'Response: ', code, message);
		await res.writeHead(code);
		await res.end(message);
	} else log(LOG_LEVELS.DEBUG, "(Response already sent) ", message);
}

// Database functions
async function writeToDb(data){
	try {
		log(LOG_LEVELS.DEBUG,"writeToDb trying insert....");
		const database = dbClient.db(config.dbCfg.dbName);
		const msg = database.collection('msg');
		const msgObj = { "received_at": Date.now(), "content": data, "processed":"Error" };
		const result = await msg.insertOne(msgObj);
		let dataObj = JSON.parse(data);
		let valueObj = new Object();
		const msgItems = dataObj['msg-items'];
		msgItems.forEach((item, index) => {
			valueObj.push({
				"itemType": "deviceReading",
				"receivedAt": Date.now(),
				"deviceId": dataObj['msg-header']['dev_id'],
				"validAt": dataObj['msg-header']['valid_at'],
				"valueType": item.val_type,
				"value": item.value
			});
		});
		const valuesCollection = database.collection('values');
		for (const value of valueObj) {
            await valuesCollection.insertOne(value);
        }
        const updateResult = await msg.updateOne(
            { _id: result.insertedId },
            { $set: { processed: "Success" } }
        );
		log(LOG_LEVELS.DEBUG,"Insert to msg:\n", result);
		log(LOG_LEVELS.DEBUG,"Insert to values:",valueObj.length,"\n");
		return true;
	}
	catch (error) {
		log(LOG_LEVELS.ERROR,"writeToDb Error:", error.message);
		return false;
	} 
}


async function readFromDb(data,result){
	try{
		const query=JSON.parse(data);
		log(LOG_LEVELS.DEBUG,"readFromDb trying find....");
		const database = dbClient.db(config.dbCfg.dbName);
		const msg = database.collection('msg');
		result = await msg.find(query).toArray();
		log(LOG_LEVELS.DEBUG,"dbFindResult:\n", result);
		return true;
	} catch (error) {
		result[0]= error.message;
		return false;
	}
}

// Server startup
async function startServer() {
    try {
        // Validate required properties
        if (!config) throw new Error("Missing required 'towerSrvCfg.json' file");
        if (!config.httpCfg.port) throw new Error("Missing required config property in 'towerSrvCfg.json': httpCfg.port");
        if (!config.httpCfg.host) throw new Error("Missing required config property in 'towerSrvCfg.json': httpCfg.host");
        if (!config.dbCfg.uri) throw new Error("Missing required config property in 'towerSrvCfg.json': dbCfg.uri");
		setLogLevel(config.loglevel);

        // Prepare the MongoDB server connection
        dbClient = new MongoClient(config.dbCfg.uri);
        await dbClient.connect();
        log(LOG_LEVELS.INFO,"Connected successfully to MongoDB");

        // Prepare and start the HTTP server
        const httpServer = createServer(httpListener);
        httpServer.listen(config.httpCfg.port, config.httpCfg.host, () => {
            log(LOG_LEVELS.INFO,`Server running at http://${config.httpCfg.host}:${config.httpCfg.port}/`);
        });
	} catch (error) {
		log(LOG_LEVELS.ERROR, "Error starting server:", error.message);
		await shutdown(1); // Gracefully shut down with an error code
	}
}

// Graceful shutdown
process.on('uncaughtException', (error) => {
    log(LOG_LEVELS.ERROR,"Uncaught Exception:", error.message);
    shutdown(1); e
});
process.on('unhandledRejection', (reason, promise) => {
    log(LOG_LEVELS.ERROR,"Unhandled Rejection:", reason);
    shutdown(1); 
});
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));


// Define the shutdown function globally
const shutdown = async (exitCode) => {
    log(LOG_LEVELS.INFO,"Shutting down server...");
    if (dbClient) {
        await dbClient.close();
    }
    if (httpServer) {
        httpServer.close(() => {
			log(LOG_LEVELS.INFO,"Server shut down");
			process.exit(exitCode);
		});
    } 
	log(LOG_LEVELS.INFO,"Server shut down");
    process.exit(exitCode);
};

// Test
import fs from 'fs';
import path from 'path';

// Function to read the content of samplePOST.json and call writeToDb
async function testWriteToDb() {
    try {
        // Read the content of samplePOST.json
        const filePath = path.join(path.resolve(), 'samplePOST.json');
        const data = fs.readFileSync(filePath, 'utf8');

        // Call writeToDb with the string content of samplePOST.json
        const result = await writeToDb(data);

        // Log the result
        console.log("Test completed:", result);
    } catch (error) {
        console.error("Test failed:", error);
    }
}


// Call the test function
testWriteToDb();

