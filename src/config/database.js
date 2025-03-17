// config/database.js
const { MongoClient, ServerApiVersion } = require('mongodb');
const mongoose = require('mongoose');
const path = require('path');

// Define path to your certificate file
const CERT_FILE_PATH = process.env.MONGODB_CERT_CONTENT 

// MongoDB connection URI
const DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/train-ticket-api';

// MongoDB connection options for mongoose
const DB_OPTIONS = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  tlsCertificateKeyFile: CERT_FILE_PATH,
  serverApi: ServerApiVersion.v1
};

// Test connection function (can be called before starting the app)
async function testMongoConnection() {
  const client = new MongoClient(DB_URI, {
    tlsCertificateKeyFile: CERT_FILE_PATH,
    serverApi: ServerApiVersion.v1
  });
  
  try {
    console.log('Testing MongoDB connection...');
    await client.connect();
    console.log('MongoDB connection successful!');
    await client.close();
    return true;
  } catch (error) {
    console.error('MongoDB connection test failed:', error);
    return false;
  }
}

module.exports = {
  DB_URI,
  DB_OPTIONS,
  testMongoConnection
};