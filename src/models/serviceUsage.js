
// models/serviceUsage.js
const mongoose = require('mongoose');

const serviceUsageSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  serviceId: { type: String, required: true },
  operator: String,
  operatorCode: String,
  originCrs: String,
  originName: String,
  destinationCrs: String,
  destinationName: String,
  departureTime: Date,
  arrivalTime: Date,
  confidence: { type: Number, default: 0.5 },
  journeyDate: { type: String, index: true }, // YYYY-MM-DD format
  isConfirmedByUser: { type: Boolean, default: false }
}, {
  timestamps: true
});

serviceUsageSchema.index({ userId: 1, journeyDate: 1 });
serviceUsageSchema.index({ userId: 1, departureTime: -1 });

const ServiceUsage = mongoose.model('ServiceUsage', serviceUsageSchema);
module.exports = ServiceUsage;