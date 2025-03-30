// models/stationVisit.js
const mongoose = require('mongoose');

const stationVisitSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  timestamp: { type: Date, required: true, default: Date.now },
  stationCrs: { type: String, required: true },
  stationName: { type: String, required: true },
  coordinates: {
    latitude: Number,
    longitude: Number
  },
  possibleDepartures: [{
    serviceId: String,
    std: String,
    etd: String,
    platform: String,
    operator: String,
    operatorCode: String,
    origin: mongoose.Schema.Types.Mixed,
    destination: mongoose.Schema.Types.Mixed,
    isCancelled: Boolean
  }],
  possibleArrivals: [{
    serviceId: String,
    sta: String,
    eta: String,
    platform: String,
    operator: String,
    operatorCode: String,
    origin: mongoose.Schema.Types.Mixed,
    destination: mongoose.Schema.Types.Mixed,
    isCancelled: Boolean
  }]
}, {
  timestamps: true
});

stationVisitSchema.index({ userId: 1, timestamp: -1 });
stationVisitSchema.index({ stationCrs: 1 });

const StationVisit = mongoose.model('StationVisit', stationVisitSchema);
module.exports = StationVisit;
