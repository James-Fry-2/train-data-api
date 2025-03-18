// scripts/importStations.js
const axios = require('axios');
const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');
console.log('Current working directory:', process.cwd());
console.log('__dirname:', __dirname);
console.log('Looking for .env at:', path.resolve(process.cwd(), '.env'));
console.log('Environment loaded:', process.env.MONGODB_URI ? 'Yes' : 'No');
// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });
console.log('Environment loaded:', process.env.MONGODB_URI ? 'Yes' : 'No');

// Import database configuration
const { DB_URI, DB_OPTIONS } = require('../config/database');

// URL to the stations JSON file
const STATIONS_JSON_URL = 'https://raw.githubusercontent.com/davwheat/uk-railway-stations/main/stations.json';

// Define the Station model schema
const stationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  crs: { type: String, required: true, unique: true, index: true },
  stationOperator: String,
  fastestServices: [String], // Array of destination CRS codes (for recommended searches)
  coordinates: {
    latitude: Number,
    longitude: Number
  },
  address: String,
  postcode: String,
  facilities: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Create the Station model
const Station = mongoose.model('Station', stationSchema);

/**
 * Fetches station data from the GitHub repository
 * @returns {Promise<Array>} Array of station objects
 */
async function fetchStationData() {
  try {
    console.log('Fetching station data from GitHub...');
    const response = await axios.get(STATIONS_JSON_URL);
    return response.data;
  } catch (error) {
    console.error('Error fetching station data:', error.message);
    throw error;
  }
}

/**
 * Transforms the raw station data to match our database schema
 * @param {Array} rawStations - Raw station data from JSON
 * @returns {Array} Transformed station objects
 */
function transformStationData(rawStations) {
  console.log(`Transforming ${rawStations.length} station records...`);
  
  return rawStations.map(station => ({
    name: station.stationName || station.name,
    crs: (station.crsCode || station.crs || '').toUpperCase(), // Ensure CRS is uppercase as per API requirements
    stationOperator: station.operator || station.stationOperator || 'Unknown',
    fastestServices: [], // Will be populated later based on popular destinations
    coordinates: {
      latitude: station.lat || station.latitude || (station.location ? station.location.latitude : null),
      longitude: station.long || station.longitude || (station.location ? station.location.longitude : null)
    },
    address: station.address || '',
    postcode: station.postcode || '',
    facilities: station.facilities || {}
  }));
}

/**
 * Imports stations into the database
 * @param {Array} stations - Transformed station objects
 */
async function importStations(stations) {
  try {
    console.log(`Beginning import of ${stations.length} stations...`);
    
    // Find existing stations in one query to avoid individual lookups
    const existingCRSCodes = new Set((await Station.find({}, 'crs').lean())
      .map(station => station.crs));
    
    // Prepare bulk operations
    const bulkOps = [];
    
    stations.forEach(station => {
      if (existingCRSCodes.has(station.crs)) {
        // Update operation
        bulkOps.push({
          updateOne: {
            filter: { crs: station.crs },
            update: { $set: { ...station, updatedAt: new Date() } }
          }
        });
      } else {
        // Insert operation
        bulkOps.push({
          insertOne: {
            document: station
          }
        });
      }
    });
    
    // Execute bulk operations in batches
    const BATCH_SIZE = 500;
    let results = { inserted: 0, updated: 0, errors: 0 };
    
    for (let i = 0; i < bulkOps.length; i += BATCH_SIZE) {
      const batch = bulkOps.slice(i, i + BATCH_SIZE);
      try {
        const result = await Station.bulkWrite(batch, { ordered: false });
        results.inserted += result.insertedCount || 0;
        results.updated += result.modifiedCount || 0;
      } catch (error) {
        console.error(`Error in batch ${i}-${i + batch.length}:`, error.message);
        results.errors++;
      }
      
      // Log progress periodically
      if (i % (BATCH_SIZE * 4) === 0) {
        console.log(`Progress: ${i}/${bulkOps.length} operations processed`);
      }
    }
    
    console.log(`Import complete: ${results.inserted} inserted, ${results.updated} updated, ${results.errors} errors`);
  } catch (error) {
    console.error('Error during import process:', error.message);
    throw error;
  }
}
/**
 * Main function to run the import process
 */
async function main() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(DB_URI, DB_OPTIONS);
    console.log('Connected to MongoDB');
    
    // Fetch and process station data
    const rawStations = await fetchStationData();
    const transformedStations = transformStationData(rawStations);
    
    // Import stations to database
    await importStations(transformedStations);
    
    console.log('Station import process completed successfully');
  } catch (error) {
    console.error('Station import failed:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the import process
main();