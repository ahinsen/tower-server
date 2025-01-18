/* Listen to, and process HTTP  calls:
- HTTP POST requests will be written to the db
- HTTP GET requests will return the result of a query
check log using journalctl -u iotsrv.service
*/
// Read and validate config properties

import config from './towerSrvCfg.json' assert { type: 'json' };
try {
	if (!config) {      throw new Error("Missing required 'towerSrvCfg.json' file"); }
	if (!config.httpCfg.port) { throw new Error("Missing required config property: httpCfg.port");}
    if (!config.httpCfg.host) { throw new Error("Missing required config property: httpCfg.host");}
    if (!config.dbCfg.uri) {  throw new Error("Missing required config property: dbCfg.uri"); }
} catch (error) {
    console.error("Error in 'towerSrvCfg.json':", error.message);
    process.exit(1); // Exit the application with an error code
}

//Prepare the mongoDB server connection
import { MongoClient } from 'mongodb';
const client = new MongoClient(config.dbCfg.uri);

//Prepare and start the HTTP server
import { createServer } from "http";
import httpListener from './httpListener.js';
const server = createServer(httpListener);
server.listen(config.httpCfg.port, config.httpCfg.host, () => {
    console.log(`Tower server is running on http://${config.httpCfg.host}:${config.httpCfg.port}`);
});





