// models/station.js
const mongoose = require('mongoose');

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
  
  // Additional fields to preserve original data format
  stationName: String,
  crsCode: String,
  lat: Number,
  long: Number,
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Add text indexes for search functionality
stationSchema.index({ name: 'text', crs: 'text' });

// Create a compound index for geospatial queries
stationSchema.index({ 'coordinates.latitude': 1, 'coordinates.longitude': 1 });

const Station = mongoose.model('Station', stationSchema);
module.exports = Station;