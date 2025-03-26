import xlsx from 'xlsx';
import path from 'path';
import { MongoClient } from 'mongodb';

const dbUri = "mongodb://127.0.0.1:27017/?directConnection=true&serverSelectionTimeoutMS=20000";
const dbName = 'iotsrv';
const collectionName = 'values';
const filepath = './dbutil';
const filename = 'export1.xlsx';
const sheetname = 'values';

const client = new MongoClient(dbUri);

(async () => {
  try {
    await client.connect();
    const database = client.db(dbName);
    const collection = database.collection(collectionName);

    // Fetch all items from the collection
    const items = await collection.find({}).toArray();

    if (items.length === 0) {
      throw new Error(`No documents found in collection ${collectionName}`);
    }

    // Determine all properties that exist in the objects
    const allKeys = new Set();
    items.forEach(item => {
      Object.keys(item).forEach(key => allKeys.add(key));
    });

    const headers = Array.from(allKeys);

    // Prepare data for the Excel sheet
    const data = [headers];
    items.forEach(item => {
      const row = headers.map(header => {
        const value = item[header];
        return typeof value === 'object' && value !== null ? '{Object}' : value;
      });
      data.push(row);
    });

    // Construct the absolute path to the Excel file
    const filePath = path.resolve(filepath, filename);

    // Read or create the workbook
    let workbook;
    try {
      workbook = xlsx.readFile(filePath);
    } catch (error) {
      workbook = xlsx.utils.book_new();
    }

    // Clear the sheet if it already exists
    if (workbook.Sheets[sheetname]) {
      delete workbook.Sheets[sheetname];
    }

    // Create a new sheet with the data
    const worksheet = xlsx.utils.aoa_to_sheet(data);
    xlsx.utils.book_append_sheet(workbook, worksheet, sheetname);

    // Write the workbook to the file
    xlsx.writeFile(workbook, filePath);

    console.log(`Data successfully written to ${filePath}`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
})();