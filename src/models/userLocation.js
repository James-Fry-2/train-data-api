const mongoose = require('mongoose');

const userLocationSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  timestamp: { type: Date, required: true, default: Date.now },
  coordinates: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracy: Number
  },
  speed: Number,
  heading: Number,
  altitude: Number,
  accelerometer: {
    x: Number,
    y: Number,
    z: Number,
    magnitude: Number
  },
  activityType: {
    type: String,
    enum: ['stationary', 'walking', 'running', 'cycling', 'automotive', 'train', 'unknown'],
    default: 'unknown'
  }
}, {
  timestamps: true
});

userLocationSchema.index({ userId: 1, timestamp: -1 });
// Spatial index for location-based queries
userLocationSchema.index({ 'coordinates.latitude': 1, 'coordinates.longitude': 1 });

const UserLocation = mongoose.model('UserLocation', userLocationSchema);
module.exports = UserLocation;