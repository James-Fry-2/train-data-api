// routes/stationData.js
const express = require('express');
const router = express.Router();
const Station = require('../models/station');
const auth = require('../middleware/auth');
const { validateRequest } = require('../utils/validators');

/**
 * @route GET /api/station-data
 * @desc Search for stations by name or CRS code
 * @access Private
 */
router.get('/', auth, validateRequest, async (req, res, next) => {
  try {
    const { query, limit = 10, page = 1 } = req.query;
    const skip = (page - 1) * limit;
    
    let queryObj = {};
    
    if (query) {
      if (query.length === 3 && /^[A-Za-z]{3}$/.test(query)) {
        // If query is exactly 3 alphabetic characters, treat as CRS code
        queryObj.$or = [
          { crs: query.toUpperCase() },
          { crsCode: query.toUpperCase() }
        ];
      } else {
        // Otherwise treat as a search term for the station name
        queryObj.$or = [
          { $text: { $search: query } },
          { name: { $regex: query, $options: 'i' } },
          { stationName: { $regex: query, $options: 'i' } }
        ];
      }
    }
    
    const stations = await Station.find(queryObj)
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const total = await Station.countDocuments(queryObj);
    
    res.json({
      stations,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/station-data/:crs
 * @desc Get station details by CRS code
 * @access Private
 */
router.get('/:crs', auth, validateRequest, async (req, res, next) => {
  try {
    const { crs } = req.params;
    
    // Validate CRS code format
    if (!crs || !/^[A-Z]{3}$/.test(crs.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid CRS code' });
    }
    
    const station = await Station.findOne({ crs: crs.toUpperCase() }).lean();
    
    if (!station) {
      return res.status(404).json({ error: 'Station not found' });
    }
    
    res.json(station);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/station-data/nearby
 * @desc Find stations near a given location
 * @access Private
 */
router.get('/nearby', auth, validateRequest, async (req, res, next) => {
  try {
    const { lat, lon, radius = 10, limit = 10 } = req.query;
    
    // Validate latitude and longitude
    if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'Valid latitude and longitude are required' });
    }
    
    // Basic proximity search based on coordinates
    // Note: For a more sophisticated geospatial search, you might want to
    // implement a proper geo query using $near or similar MongoDB operators
    const stations = await Station.find({
      'coordinates.latitude': { $exists: true, $ne: null },
      'coordinates.longitude': { $exists: true, $ne: null }
    }).lean();
    
    // Calculate distance for each station and filter
    const maxDistance = parseFloat(radius); // in kilometers
    const nearbyStations = stations
      .map(station => {
        const distance = calculateDistance(
          parseFloat(lat),
          parseFloat(lon),
          station.coordinates.latitude,
          station.coordinates.longitude
        );
        return { ...station, distance };
      })
      .filter(station => station.distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, parseInt(limit));
    
    res.json({
      stations: nearbyStations,
      count: nearbyStations.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Calculate distance between two points using the Haversine formula
 * @param {number} lat1 - Latitude of point 1 in degrees
 * @param {number} lon1 - Longitude of point 1 in degrees
 * @param {number} lat2 - Latitude of point 2 in degrees
 * @param {number} lon2 - Longitude of point 2 in degrees
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in km
  
  return distance;
}

module.exports = router;