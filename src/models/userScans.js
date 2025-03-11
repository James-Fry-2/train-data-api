// models/userScan.js
const mongoose = require('mongoose');

const userScanSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  scanTimestamp: { type: Date, required: true, default: Date.now },
  
  // Ticket details
  ticketType: { type: String, required: true },
  ticketReference: { type: String, required: true },
  validFrom: Date,
  validTo: Date,
  
  // Journey details
  originStation: String,
  originCrs: String,
  destinationStation: String,
  destinationCrs: String,
  
  // Service details (optional - linked to actual service if available)
  serviceId: String,
  scheduledDeparture: Date,
  platform: String,
  
  // Metadata
  scanLocation: {
    type: { type: String, enum: ['station', 'train', 'other'], default: 'station' },
    crs: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  deviceId: String,
  isValid: { type: Boolean, default: true },
  validationMessage: String,
  
  // Raw data from ticket scan
  rawData: String
}, {
  timestamps: true
});

userScanSchema.index({ userId: 1, scanTimestamp: -1 });
userScanSchema.index({ ticketReference: 1 });

const UserScan = mongoose.model('UserScan', userScanSchema);
module.exports = UserScan;