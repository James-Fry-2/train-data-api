// routes/services.js
const express = require('express');
const router = express.Router();
const ldbwsService = require('../services/ldbwsService');
const dbService = require('../services/dbService');
const { validateRequest } = require('../utils/validators');
const auth = require('../middleware/auth');

/**
 * @route GET /api/services/:serviceId
 * @desc Get details for a specific service
 * @access Private
 */
router.get('/:serviceId', auth, validateRequest, async (req, res, next) => {
  try {
    const { serviceId } = req.params;
    const { refresh = false } = req.query;
    
    // Try to get from cache first if refresh is not requested
    if (!refresh) {
      const cachedData = await dbService.getServiceDetails(serviceId);
      if (cachedData && Date.now() - new Date(cachedData.generatedAt).getTime() < 60000) {
        return res.json(cachedData);
      }
    }
    
    // Get fresh data from LDBWS
    const serviceDetails = await ldbwsService.getServiceDetails(serviceId);
    
    // Save to database and return
    await dbService.saveServiceDetails(serviceDetails);
    res.json(serviceDetails);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/services/next-departures/:crs
 * @desc Get next departures for specific destinations
 * @access Private
 */
router.get('/next-departures/:crs', auth, validateRequest, async (req, res, next) => {
  try {
    const { crs } = req.params;
    const { destinations, timeOffset, timeWindow } = req.query;
    
    // Validate CRS code
    if (!crs || !/^[A-Z]{3}$/.test(crs.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid CRS code' });
    }
    
    // Parse destinations array from query
    let destinationsList = [];
    if (typeof destinations === 'string') {
      destinationsList = destinations.split(',').map(d => d.trim());
    } else if (Array.isArray(destinations)) {
      destinationsList = destinations;
    }
    
    // Validate destinations
    if (!destinationsList.length) {
      return res.status(400).json({ error: 'At least one destination must be provided' });
    }
    
    // Get data from LDBWS
    const options = { timeOffset, timeWindow };
    const nextDepartures = await ldbwsService.getNextDepartures(crs, destinationsList, options);
    
    res.json(nextDepartures);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/services/next-departures/:crs/details
 * @desc Get next departures with details for specific destinations
 * @access Private
 */
router.get('/next-departures/:crs/details', auth, validateRequest, async (req, res, next) => {
  try {
    const { crs } = req.params;
    const { destinations, timeOffset, timeWindow } = req.query;
    
    // Validate CRS code
    if (!crs || !/^[A-Z]{3}$/.test(crs.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid CRS code' });
    }
    
    // Parse destinations array from query
    let destinationsList = [];
    if (typeof destinations === 'string') {
      destinationsList = destinations.split(',').map(d => d.trim());
    } else if (Array.isArray(destinations)) {
      destinationsList = destinations;
    }
    
    // Validate destinations
    if (!destinationsList.length || destinationsList.length > 10) {
      return res.status(400).json({ error: 'Between 1 and 10 destinations must be provided' });
    }
    
    // Get data from LDBWS
    const options = { timeOffset, timeWindow };
    const nextDepartures = await ldbwsService.getNextDeparturesWithDetails(crs, destinationsList, options);
    
    res.json(nextDepartures);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/services/fastest-departures/:crs
 * @desc Get fastest departures for specific destinations
 * @access Private
 */
router.get('/fastest-departures/:crs', auth, validateRequest, async (req, res, next) => {
  try {
    const { crs } = req.params;
    const { destinations, timeOffset, timeWindow } = req.query;
    
    // Validate CRS code
    if (!crs || !/^[A-Z]{3}$/.test(crs.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid CRS code' });
    }
    
    // Parse destinations array from query
    let destinationsList = [];
    if (typeof destinations === 'string') {
      destinationsList = destinations.split(',').map(d => d.trim());
    } else if (Array.isArray(destinations)) {
      destinationsList = destinations;
    }
    
    // Validate destinations
    if (!destinationsList.length || destinationsList.length > 15) {
      return res.status(400).json({ error: 'Between 1 and 15 destinations must be provided' });
    }
    
    // Get data from LDBWS
    const options = { timeOffset, timeWindow };
    const fastestDepartures = await ldbwsService.getFastestDepartures(crs, destinationsList, options);
    
    res.json(fastestDepartures);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/services/fastest-departures/:crs/details
 * @desc Get fastest departures with details for specific destinations
 * @access Private
 */
router.get('/fastest-departures/:crs/details', auth, validateRequest, async (req, res, next) => {
  try {
    const { crs } = req.params;
    const { destinations, timeOffset, timeWindow } = req.query;
    
    // Validate CRS code
    if (!crs || !/^[A-Z]{3}$/.test(crs.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid CRS code' });
    }
    
    // Parse destinations array from query
    let destinationsList = [];
    if (typeof destinations === 'string') {
      destinationsList = destinations.split(',').map(d => d.trim());
    } else if (Array.isArray(destinations)) {
      destinationsList = destinations;
    }
    
    // Validate destinations
    if (!destinationsList.length || destinationsList.length > 10) {
      return res.status(400).json({ error: 'Between 1 and 10 destinations must be provided' });
    }
    
    // Get data from LDBWS
    const options = { timeOffset, timeWindow };
    const fastestDepartures = await ldbwsService.getFastestDeparturesWithDetails(crs, destinationsList, options);
    
    res.json(fastestDepartures);
  } catch (error) {
    next(error);
  }
});

module.exports = router;