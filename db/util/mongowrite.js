


const { Console } = require('console');

var MongoClient = require('mongodb').MongoClient;
var uri = "mongodb://tech01:tech01@127.0.0.1:27017/?directConnection=true&serverSelectionTimeoutMS=20000&authSource=admin";

const client = new MongoClient(uri);

async function run() {
  try {
    console.log("Trying insert....");
    const database = client.db('iotsrv');
    const msg = database.collection('msg');
    const myobj = { received_at: Date.now(), content: "Highway 37" };
    const result = await msg.insertOne(myobj);
    console.log(result);
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
    console.log("Done.");
  }
}
run().catch(console.dir);
