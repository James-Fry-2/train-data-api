// models/serviceDetails.js
const mongoose = require('mongoose');

const callingPointSchema = new mongoose.Schema({
  locationName: String,
  crs: String,
  st: String,
  et: String,
  at: String,
  isCancelled: Boolean,
  length: Number,
  detachFront: Boolean,
  adhocAlerts: [String],
  uncertainty: mongoose.Schema.Types.Mixed,
  affectedBy: String
}, { _id: false });

const callingPointListSchema = new mongoose.Schema({
  callingPoints: [callingPointSchema],
  serviceType: String,
  serviceChangeRequired: Boolean,
  assocIsCancelled: Boolean
}, { _id: false });

const serviceDetailsSchema = new mongoose.Schema({
  generatedAt: { type: Date, required: true },
  serviceID: { type: String, required: true, index: true },
  rsid: String,
  serviceType: String,
  locationName: String,
  crs: String,
  operator: String,
  operatorCode: String,
  isCancelled: Boolean,
  cancelReason: String,
  delayReason: String,
  overdueMessage: String,
  length: Number,
  detachFront: Boolean,
  isReverseFormation: Boolean,
  platform: String,
  sta: String,
  eta: String,
  ata: String,
  std: String,
  etd: String,
  atd: String,
  adhocAlerts: [String],
  previousCallingPoints: [[callingPointSchema]],
  subsequentCallingPoints: [[callingPointSchema]],
  formation: mongoose.Schema.Types.Mixed,
  diversionReason: String,
  divertedVia: String,
  timestamp: { type: Date, default: Date.now }
}, {
  timestamps: true
});

serviceDetailsSchema.index({ serviceID: 1, generatedAt: -1 });

const ServiceDetails = mongoose.model('ServiceDetails', serviceDetailsSchema);
module.exports = ServiceDetails;