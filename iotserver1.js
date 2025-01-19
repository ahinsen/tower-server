/* Listen to, and process HTTP  calls:
- HTTP POST requests will be written to the db
- HTTP GET requests will return the result of a query
check log using journalctl -u iotsrv.service
*/
// Read and validate config properties

import config from './towerSrvCfg.json' assert { type: 'json' };
import { MongoClient } from 'mongodb';
import { createServer } from 'http';
import { error } from 'console';

let dbClient;
let httpServer;

startServer();

// processing the http request
const httpListener = async function(req, res) {
	let data = '';
	req.on('data', chunk => data += chunk.toString());
	req.on('end', async () => {
		try {
			if (config.loglevel === 'debug') {
				console.log('Request Headers:', req.headers);
				console.log('Request Method:', req.method);
				console.log('Request URL:', req.url);
				console.log('Data:', data);
			}
			if (req.method === 'POST') {
				if (await writeToDb(data)) httpResponse(res,200,"success");
				else                       httpResponse(res,500,'db write error');
			} else if (req.method === 'GET') {
				if(await readFromDb(data,res)) httpResponse(res,200,"success");
				else                           httpResponse(res,500,'db read error');
			} else httpResponse(res,400,"Unsupported request method:"+req.method);
		} catch (error) {
			httpResponse(res,500, "Error during processing request"+error.message);
		}
	});
	//req.on('error', () => {httpResponse(res,500, "Error during processing request. Receieved:"+data);});
	//req.on('close', () => {httpResponse(res,500, "Request closed before completion"+data);}); 
};

function httpResponse(res, code, message) {
	if (config.loglevel === 'debug') {console.log('Response:', code, message);}
	res.writeHead(code);
	res.end(message);
}

async function startServer() {
    try {
        // Validate required properties
        if (!config) throw new Error("Missing required 'towerSrvCfg.json' file");
        if (!config.httpCfg.port) throw new Error("Missing required config property in 'towerSrvCfg.json': httpCfg.port");
        if (!config.httpCfg.host) throw new Error("Missing required config property in 'towerSrvCfg.json': httpCfg.host");
        if (!config.dbCfg.uri) throw new Error("Missing required config property in 'towerSrvCfg.json': dbCfg.uri");

        // Prepare the MongoDB server connection
        dbClient = new MongoClient(config.dbCfg.uri);
        await dbClient.connect();
        console.log("Connected successfully to MongoDB");

        // Prepare and start the HTTP server
        const httpServer = createServer(httpListener);
        httpServer.listen(config.httpCfg.port, config.httpCfg.host, () => {
            console.log(`Server running at http://${config.httpCfg.host}:${config.httpCfg.port}/`);
        });
	} catch (error) {
		console.error("Error starting server:", error.message);
		await shutdown(1); // Gracefully shut down with an error code
	}
}

// Database functions
async function writeToDb(data){
	try {
		console.log("writeToDb trying insert....");
		const database = dbClient.db('iotsrv');
		const msg = database.collection('msg');
		const myobj = { received_at: Date.now(), content: data };
		const result = await msg.insertOne(myobj);
		console.log("dbInsertOneResult:\n",result);
		return true;
	}
	catch (error) {
		console.error("writeToDb Error:", error.message);
		return false;
	} 
}
async function readFromDb(data,res){
	console.log('getFromDb request:\n'+req.toString());
	res.end('GET request\n');
}



// Graceful shutdown
process.on('uncaughtException', (error) => {
    console.error("Uncaught Exception:", error.message);
    shutdown(1); e
});
process.on('unhandledRejection', (reason, promise) => {
    console.error("Unhandled Rejection:", reason);
    shutdown(1); 
});
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));


// Define the shutdown function globally
const shutdown = async (exitCode) => {
    console.log("Shutting down server...");
    if (dbClient) {
        await dbClient.close();
    }
    if (httpServer) {
        httpServer.close(() => {
			console.log("Server shut down");
			process.exit(exitCode);
		});
    } 
	console.log("Server shut down");
    process.exit(exitCode);
};



