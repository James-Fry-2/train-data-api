// models/stationBoard.js
const mongoose = require('mongoose');

const serviceLocationSchema = new mongoose.Schema({
  locationName: String,
  crs: String,
  via: String,
  futureChangeTo: String,
  assocIsCancelled: Boolean
}, { _id: false });

const serviceItemSchema = new mongoose.Schema({
  rsid: String,
  origin: [serviceLocationSchema],
  destination: [serviceLocationSchema],
  currentOrigins: [serviceLocationSchema],
  currentDestinations: [serviceLocationSchema],
  sta: String,
  eta: String,
  std: String,
  etd: String,
  platform: String,
  operator: String,
  operatorCode: String,
  isCircularRoute: Boolean,
  isCancelled: Boolean,
  filterLocationCancelled: Boolean,
  serviceType: String,
  length: Number,
  detachFront: Boolean,
  isReverseFormation: Boolean,
  cancelReason: String,
  delayReason: String,
  serviceID: String,
  adhocAlerts: [String],
  formation: mongoose.Schema.Types.Mixed,
  uncertainty: mongoose.Schema.Types.Mixed,
  affectedBy: String
}, { _id: false });

const stationBoardSchema = new mongoose.Schema({
  generatedAt: { type: Date, required: true },
  locationName: { type: String, required: true },
  crs: { type: String, required: true, index: true },
  filterLocationName: String,
  filtercrs: String,
  filterType: String,
  nrccMessages: [String],
  platformAvailable: Boolean,
  areServicesAvailable: Boolean,
  trainServices: [serviceItemSchema],
  busServices: [serviceItemSchema],
  ferryServices: [serviceItemSchema],
  timestamp: { type: Date, default: Date.now }
}, {
  timestamps: true
});

stationBoardSchema.index({ crs: 1, generatedAt: -1 });

const StationBoard = mongoose.model('StationBoard', stationBoardSchema);
module.exports = StationBoard;