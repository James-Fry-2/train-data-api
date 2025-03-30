const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { validateRequest } = require('../utils/validators');
const journeyDetectionService = require('../services/journeyDetectionService');
const dbService = require('../services/dbService');

/**
 * @route POST /api/location-tracking/update
 * @desc Update user location and track journey
 * @access Private
 */
router.post('/update', auth, validateRequest, async (req, res, next) => {
  try {
    const { latitude, longitude, accuracy, speed, heading, altitude, accelerometer, timestamp } = req.body;
    const userId = req.user.id;
    
    // Validate required fields
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }
    
    // Process location update
    const locationData = {
      userId,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      coordinates: {
        latitude,
        longitude,
        accuracy: accuracy || 0
      },
      speed: speed || 0,
      heading,
      altitude,
      accelerometer: accelerometer ? {
        x: accelerometer.x,
        y: accelerometer.y,
        z: accelerometer.z,
        magnitude: Math.sqrt(
          Math.pow(accelerometer.x || 0, 2) + 
          Math.pow(accelerometer.y || 0, 2) + 
          Math.pow(accelerometer.z || 0, 2)
        )
      } : undefined
    };
    
    // Save location data
    await dbService.saveUserLocation(locationData);
    
    // Process for journey detection
    const journeyUpdate = await journeyDetectionService.processLocationUpdate(
      userId, locationData
    );
    
    res.json({
      message: 'Location updated successfully',
      journeyStatus: journeyUpdate
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/location-tracking/journeys
 * @desc Get user journey history
 * @access Private
 */
router.get('/journeys', auth, validateRequest, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { limit = 10, skip = 0, startDate, endDate } = req.query;
    
    const journeys = await dbService.getUserServiceHistory(userId, {
      limit: parseInt(limit),
      skip: parseInt(skip),
      startDate,
      endDate
    });
    
    res.json({
      journeys,
      count: journeys.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/location-tracking/current-journey
 * @desc Get user's current journey if any
 * @access Private
 */
router.get('/current-journey', auth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const currentJourney = await journeyDetectionService.getCurrentJourney(userId);
    
    if (!currentJourney) {
      return res.json({ inProgress: false });
    }
    
    res.json({
      inProgress: true,
      journey: currentJourney
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;