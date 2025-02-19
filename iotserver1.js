/* Listen to, and process HTTP  calls:
- HTTP POST requests will be written to the db
- HTTP GET requests will return the result of a query
check log using journalctl -u iotsrv.service
*/
// Read and validate config properties


//import config from './towerSrvCfg.json' assert { type: 'json' };
import { MongoClient } from 'mongodb';
import { createServer } from 'http';
import { LOG_LEVELS, setLogLevel, log } from './log.js';
import url from 'url';
import querystring from 'querystring';
import { promises as fs } from 'fs';
import path from 'path';
// Read and parse the JSON configuration file
const configPath = path.resolve('./towerSrvCfg.json');
const configData = await fs.readFile(configPath, 'utf-8');
const config = JSON.parse(configData);

let dbClient;
let httpServer;

startServer();

// processing the http request
const httpListener = async function(req, res) {
	let data = '';
	let result = [""];
	let resp={code:500, message:"Error processing request"};	
	req.on('data', chunk => data += chunk.toString());
	req.on('end', async () => {
		try {
			log(LOG_LEVELS.DEBUG,'Request Headers:', req.headers);
			log(LOG_LEVELS.DEBUG,'Request Method:', req.method);
			log(LOG_LEVELS.DEBUG,'Request URL:', req.url);
			log(LOG_LEVELS.DEBUG,'Data:', data);
			if (req.method === 'POST') {
				resp = await writeToDb(data); 
				httpResponse(res,resp.code,resp.message);
			} else if (req.method === 'GET') {
				if (req.url.length<=2){

					//(Object.keys(queryParams).length === 0) {
                    // No query parameters, respond with index.html
                    const filePath = path.join(path.resolve(), 'index.html');
                    fs.readFile(filePath, 'utf8', (err, content) => {
                        if (err) {
                            log(LOG_LEVELS.ERROR, "Error reading index.html:", err);
                            httpResponse(res, 500, "Error reading index.html");
                        } else {
                            res.writeHead(200, { 'Content-Type': 'text/html' });
                            res.end(content);
                        }
                    });
                } else {
                    // Assuming the query parameter is named 'query'
                	const parsedUrl = url.parse(req.url);
                	const queryParams = querystring.parse(parsedUrl.query);
                	//log(LOG_LEVELS.DEBUG, 'Query Parameters:', JSON.stringify(queryParams));
                    const queryString = queryParams.query ? decodeURIComponent(queryParams.query) : '{}';
                    log(LOG_LEVELS.DEBUG, 'Decoded queryString:', queryString);
                    if (await readFromDb(queryString, result)) {
                        httpResponse(res, 200, JSON.stringify(result));
                    } else {
                        httpResponse(res, 400, result[0]);
                    }
                }
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
	} else log(LOG_LEVELS.DEBUG, "(Response already sent) ", code,  message);
}

// Database functions
async function writeToDb(data){
	let processingStatus="parsing";
	let parseError="";
	let valueObj = [];
	let logObj=[];
	let resp={code:500,message:"Error writing to db"};
try { // Parse the message
		log(LOG_LEVELS.DEBUG,"Parsing the message....");
		let dataObj = JSON.parse(data);
		const msgItems = dataObj['msg-items'];
		log(LOG_LEVELS.DEBUG,"Found ", msgItems.length, "items in the message");
		msgItems.forEach((item, index) => {
			if (item.hasOwnProperty('val_type')) {
				valueObj.push({
					"itemType": "deviceReading",
					"receivedAt": Date.now(),
					"deviceId": dataObj['msg-header']['dev_id'],
					"validAt": dataObj['msg-header']['valid_at'],
					"valueType": item.val_type,
					"value": item.value
				});
			} else if (item.hasOwnProperty('loglevel')) {
				logObj.push({
					"receivedAt": Date.now(),
					"deviceId": dataObj['msg-header']['dev_id'],
					"validAt": dataObj['msg-header']['valid_at'],
					"logLevel": item.loglevel,
					"message": item.content
				});
			} else {
				throw new Error(`Invalid item at index ${index}: ${JSON.stringify(item)}`);
			}
		});
		processingStatus="parsedOK"
	}
	catch (error) { //Parsing error
		processingStatus="parseError";
		parseError=error.message;
		log(LOG_LEVELS.DEBUG,"Parsing error:", error.message);
		resp={code:400,message:error.message};
	}
	try { // Write to the database
		const database = dbClient.db(config.dbCfg.dbName);
		const msg = database.collection('msg');
		const msgObj = { "received_at": Date.now(), "content": data, "processed":processingStatus };
		if (parseError) msgObj["parseError"]=parseError;
		let result = await msg.insertOne(msgObj);
		if (processingStatus=="parsedOK") {
			const valuesCollection = database.collection('values');
			for (const value of valueObj) {
       		    await valuesCollection.insertOne(value);
			}
			const logCollection = database.collection('deviceLog');
			for (const logItem of logObj) {
				await logCollection.insertOne(logItem);
			}
        	result = await msg.updateOne(
        	    { _id: result.insertedId },
        	    { $set: { processed: "Success" } }
        	);
			resp={code:200,message:"Success"};
			log(LOG_LEVELS.DEBUG,"Insert to values:",valueObj.length," to deviceLog:",logObj.length);
		}
		log(LOG_LEVELS.DEBUG,"Insert to msg: ", JSON.stringify(result));
	}
	catch (error) {
		log(LOG_LEVELS.ERROR,"writeToDb Error:", error.message);
		if (resp.code==500) resp.message=error.message;
	} 
	return resp;
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
		setLogLevel(config.logLevel);

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
//import fs from 'fs';
//import path from 'path';

// Function to read the content of samplePOST.json and call writeToDb
async function testWriteToDb() {
    try {
        let filePath = path.join(path.resolve(), 'samplePOST.json');
        let data = fs.readFileSync(filePath, 'utf8');
        let resp = await writeToDb(data);
		console.log("Test1 completed:", resp.code, resp.message);

		filePath = path.join(path.resolve(), 'samplePOSTlog.json');
        data = fs.readFileSync(filePath, 'utf8');
        resp = await writeToDb(data);
        console.log("Test2 completed:", resp.code, resp.message);
    } catch (error) {
        console.error("Test failed:", error.message);
    }
}


// Call the test function
//testWriteToDb();

