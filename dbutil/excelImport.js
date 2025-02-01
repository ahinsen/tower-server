const filename = 'P01sample.xlsx';
const sheetname = 'P01';
const dbUri = "mongodb://tech01:tech01@127.0.0.1:27017/?directConnection=true&serverSelectionTimeoutMS=20000&authSource=admin";
const dbName = 'iotsrv';
const collectionName = 'values';
//------------------
import xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';
import { MongoClient } from 'mongodb';

try{
const client = new MongoClient(dbUri);
const database = client.db(dbName);
const collection = database.collection(collectionName);
const filePath = path.resolve('./dbutil', filename);
const workbook = xlsx.readFile(filePath); // Read the Excel file
const sheet = workbook.Sheets[sheetname];// Get the specified sheet
if (!sheet) {
  throw new Error(`Sheet ${sheetname} not found in file ${filename}`);
}
// Convert the sheet to JSON
const json = xlsx.utils.sheet_to_json(sheet, { header: 1 });
const headers = json[0];   // Extract the header row
// Convert the remaining rows to objects
const data = json.slice(1).map(row => {
  const obj = {};
  headers.forEach((header, index) => {
    obj[header] = row[index];
  });
  return obj;
});
const result = collection.insertMany(data);
console.log(JSON.stringify(result));
console.log('Data imported successfully');
} catch (err) {
  console.error(err);
}
