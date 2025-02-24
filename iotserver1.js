/* Listen to, and process HTTP  calls:
- HTTP POST requests will be written to the db
- HTTP GET requests will return the result of a query
check log using journalctl -u iotsrv.service
*/
// Read and validate config properties


//import config from './towerSrvCfg.json' assert { type: 'json' };
import { MongoClient } from 'mongodb';
import { createServer, get } from 'http';
import { LOG_LEVELS, setLogLevel, log } from './log.js';
import url from 'url';
import querystring from 'querystring';
import { promises as fs } from 'fs';
import path from 'path';
import { error } from 'console';
// Read and parse the JSON configuration file
const configPath = path.resolve('./towerSrvCfg.json');
const configData = await fs.readFile(configPath, 'utf-8');
const config = JSON.parse(configData);

let dbClient;
let httpServer;

let valueObj=[];
let logObj=[];
let receivedAt= Date.now();

startServer();

// processing the http request
const httpListener = async function(req, res) {
	let data = '';
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
				httpResponse(res,resp.code,resp.message); //default response if no other response is sent
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
		const currTime=new Date().toISOString();
		await res.end('{"serverTime":"'+currTime+'","message":"'+message.replace(/"/g, '\\"')+'"}');
	} else log(LOG_LEVELS.DEBUG, "(Response already sent) ", code,  message);
}

// Database functions
// Parse the message and write to the values and log collections
async function writeToDb(message){
	let processingStatus="parsing";
	let parseError=null;
	valueObj = [];
	logObj=[];
	receivedAt= Date.now();
	let resp={code:500,message:"Error writing to db"};
	try { // Parse the message
		let dataObj = JSON.parse(message);
		if (typeof dataObj !== 'array'){ //If the message is not an array
			// If it has header and items, then parse it as a two level structure
			const header = getProperty(dataObj,config.propNames.header,0,'object',null);
			const items = getProperty(dataObj,config.propNames.items,0,'array',null);
			if (header && items) {
				log(LOG_LEVELS.DEBUG,"Parsing the message as a header/item structure having ",items.length, " items....");
				items.forEach((item, index) => {parseOne(union(header, item), index);});
			} else { // Otherwise assume it is a single object
				log(LOG_LEVELS.DEBUG,"Parsing the message as a single object, ....");
				parseOne(dataObj, 0);
			}
		}	else { // If it is an array, then parse each element as a single object
			log(LOG_LEVELS.DEBUG,"Parsing the message as an array of objects, ....");
			dataObj.forEach((item, index) => {parseOne(item, index);});
		}
		processingStatus="parsedOK"
	}
	catch (error) { //Parsing error
		processingStatus="parseError";
		parseError=error.message;
		log(LOG_LEVELS.DEBUG,"Parsing error:", error.message);
	}
	try { // Write to the database
		const database = dbClient.db(config.dbCfg.dbName);
		const logCollection = database.collection('log');
		const valuesCollection = database.collection('values');
		if (parseError){ // Log the error
			const logObj = { 
				"timestamp": receivedAt, 
				"logLevel":"E",
				"message": "received content:"+message+"ERROR:"+error.message
			};
			await logCollection.insertOne(logObj);
			resp={code:400,message:parseError};
			log(LOG_LEVELS.DEBUG,"Inserted 1 item to log collection");
		}
		else {// Write the parsed message to the appropriate collections
			valueObj.forEach(async (value) => {await valuesCollection.insertOne(value);});
			logObj.forEach(async (logItem) => {await logCollection.insertOne(logItem);});
			resp={code:200,message:"Success"};
			log(LOG_LEVELS.DEBUG,"Inserted to values:",valueObj.length,"items, to log:",logObj.length,"items");
		}
	}
	catch (error) {
		log(LOG_LEVELS.ERROR,"writeToDb Error:", error.message);
		if (resp.code==500) resp.message=error.message;
	} 
	return resp;
}
// Combine two objects. Return an object that contains all the properties of both objects
function union(obj1, obj2) {
	let union = {};
	for (let key in obj1) if (obj1.hasOwnProperty(key)) {union[key] = obj1[key];}
	for (let key in obj2) if (obj2.hasOwnProperty(key)) {union[key] = obj2[key];}
	return union;
}
// Parse a single object, and add the result to the valueObj or logObj arrays
function parseOne(input,index){
	log(LOG_LEVELS.DEBUG,"Parsing single object:",JSON.stringify(input));
	const deviceId =getProperty(input, config.propNames.deviceId,  index, 'string','unknown');
	const validAt = getValidAt(input,index);
	const valueType = getProperty(input, config.propNames.valueType, index,'string', null);
	const logLevel = getProperty(input, config.propNames.logLevel, index, 'string',null);
	if (valueType) {
		const newObj ={"itemType": "deviceReading","receivedAt": receivedAt,"deviceId": deviceId,
						"validAt": validAt,"valueType": valueType,"value": input.value};
		valueObj.push(newObj);
		log(LOG_LEVELS.DEBUG,`Constructed 'values' object ${index+1}:`,JSON.stringify(newObj));
	}
	else if (logLevel){	
		const logMsg= getProperty(input, config.propNames.logMsg, index,'string', 'No message');
		const newObj ={ "itemType": "deviceLog","receivedAt": receivedAt,"deviceId": deviceId,
						"timestamp": validAt,"logLevel": logLevel,"logMsg": logMsg	};
		logObj.push(newObj);
		log(LOG_LEVELS.DEBUG,`Constructed 'log' object ${index+1}:`,JSON.stringify(newObj));
	}else {
		throw new Error(`Item ${index+1} has neither valueType, nor logLevel property: ${JSON.stringify(input)}`);
	}

}
// Obtain the validAt value from the object
function getValidAt(object,index){
	let validAt = getProperty(object, config.propNames.validAt,index,null,null);
	if (validAt){//if object has validAt property, then check the type
		if (typeof validAt === 'string') validAt = new Date(validAt).getTime()
		else if (typeof validAt !== 'number') throw new Error(`"validAt" should be string or number at item ${index+1}. Found: ${typeof validAt}`);
	} else { // If there is no validAt in the object, we try to calculate it
		if      (object.hasOwnProperty('read2sendSec')) validAt = Date.now() - (object.read2sendSec * 1000);
		else if (object.hasOwnProperty('read2sendMs'))  validAt = Date.now() - (object.read2sendMs);
		else validAt = 0;	
	}
	return validAt;
}
// look for a property (based on a list of propery names) in an object, check its type, 
// and return its value
function getProperty(object, prop,  index, type,defaultValue) {
	if (Array.isArray(prop)) {
		for (const item of prop) {
			if (chkProperty(object, item, type,index)) return object[item];
		}
		return defaultValue;
	} else
	return chkProperty(object, prop, type,index) ? object[prop] : defaultValue;
}
function chkProperty(object, prop, type,index) {
	if (object.hasOwnProperty(prop)){
		const foundType=(Array.isArray(object[prop]))? 'array': typeof object[prop];
		if (type !== null && foundType !== type) throw new Error(`Property ${prop} should be of type ${type} at item ${index+1}. Found: ${foundType}`);
		else return true;
	}
	return false;
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
    shutdown(1);
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

