import xlsx from 'xlsx';
import path from 'path';
import { MongoClient } from 'mongodb';

const filepath ='./dbutil';
const filename = 'P02sample.xlsx';
const sheetname = 'P01';
const dbUri = "mongodb://tech01:tech01@127.0.0.1:27017/?directConnection=true&serverSelectionTimeoutMS=20000&authSource=admin";
const dbName = 'iotsrv';
const collectionName = 'values';

(async () => {
  try {
    const client = new MongoClient(dbUri);
    await client.connect();
    const database = client.db(dbName);
    const collection = database.collection(collectionName);

    // Construct the absolute path to the Excel file
    const filePath = path.resolve(filepath, filename);

    // Read the Excel file
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets[sheetname];
    if (!sheet) {
      throw new Error(`Sheet ${sheetname} not found in file ${filename}`);
    }

    // Convert the sheet to JSON
    const json = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    const headers = json[0];   // Extract the header row

    // Convert the remaining rows to objects and add a new property at the beginning
    const data = json.slice(1).map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      // Add 2 new properties at the beginning of the object
      return { itemType:"import", receivedAt: Date.now(), ...obj };
    });

    const result = await collection.insertMany(data);
    console.log(JSON.stringify(result));
    console.log('Data imported successfully');
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
    console.log('MongoDB connection closed');
  }
})();