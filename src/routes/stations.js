// routes/stations.js
const express = require('express');
const router = express.Router();
const ldbwsService = require('../services/ldbwsService');
const dbService = require('../services/dbService');
const { validateRequest } = require('../utils/validators');
const auth = require('../middleware/auth');

/**
 * @route GET /api/stations/:crs/departures
 * @desc Get departure board for a station
 * @access Private
 */
router.get('/:crs/departures', auth, validateRequest, async (req, res, next) => {
  try {
    const { crs } = req.params;
    const { numRows = 10, filterCrs, filterType, timeOffset, timeWindow, refresh = false } = req.query;
    
    // Validate CRS code format
    if (!crs || !/^[A-Z]{3}$/.test(crs.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid CRS code' });
    }
    
    // Try to get from cache first if refresh is not requested
    if (!refresh) {
      const cachedData = await dbService.getLatestStationBoard(crs);
      if (cachedData && Date.now() - new Date(cachedData.generatedAt).getTime() < 60000) {
        return res.json(cachedData);
      }
    }
    
    // Get fresh data from LDBWS
    const options = { filterCrs, filterType, timeOffset, timeWindow };
    const departureBoard = await ldbwsService.getDepartureBoard(crs, numRows, options);
    
    // Save to database and return
    await dbService.saveStationBoard(departureBoard);
    res.json(departureBoard);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/stations/:crs/departures/details
 * @desc Get departure board with details for a station
 * @access Private
 */
router.get('/:crs/departures/details', auth, validateRequest, async (req, res, next) => {
  try {
    const { crs } = req.params;
    const { numRows = 10, filterCrs, filterType, timeOffset, timeWindow, refresh = false } = req.query;
    
    // Validate CRS code format
    if (!crs || !/^[A-Z]{3}$/.test(crs.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid CRS code' });
    }
    
    // Try to get from cache first if refresh is not requested
    if (!refresh) {
      const cachedData = await dbService.getLatestStationBoard(crs);
      if (cachedData && Date.now() - new Date(cachedData.generatedAt).getTime() < 60000) {
        return res.json(cachedData);
      }
    }
    
    // Get fresh data from LDBWS
    const options = { filterCrs, filterType, timeOffset, timeWindow };
    const departureBoard = await ldbwsService.getDepBoardWithDetails(crs, numRows, options);
    
    // Save to database and return
    await dbService.saveStationBoard(departureBoard);
    res.json(departureBoard);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/stations/:crs/arrivals
 * @desc Get arrival board for a station
 * @access Private
 */
router.get('/:crs/arrivals', auth, validateRequest, async (req, res, next) => {
  try {
    const { crs } = req.params;
    const { numRows = 10, filterCrs, filterType, timeOffset, timeWindow, refresh = false } = req.query;
    
    // Validate CRS code format
    if (!crs || !/^[A-Z]{3}$/.test(crs.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid CRS code' });
    }
    
    // Try to get from cache first if refresh is not requested
    if (!refresh) {
      const cachedData = await dbService.getLatestStationBoard(crs);
      if (cachedData && Date.now() - new Date(cachedData.generatedAt).getTime() < 60000) {
        return res.json(cachedData);
      }
    }
    
    // Get fresh data from LDBWS
    const options = { filterCrs, filterType, timeOffset, timeWindow };
    const arrivalBoard = await ldbwsService.getArrivalBoard(crs, numRows, options);
    
    // Save to database and return
    await dbService.saveStationBoard(arrivalBoard);
    res.json(arrivalBoard);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/stations/:crs/arrivals/details
 * @desc Get arrival board with details for a station
 * @access Private
 */
router.get('/:crs/arrivals/details', auth, validateRequest, async (req, res, next) => {
  try {
    const { crs } = req.params;
    const { numRows = 10, filterCrs, filterType, timeOffset, timeWindow, refresh = false } = req.query;
    
    // Validate CRS code format
    if (!crs || !/^[A-Z]{3}$/.test(crs.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid CRS code' });
    }
    
    // Try to get from cache first if refresh is not requested
    if (!refresh) {
      const cachedData = await dbService.getLatestStationBoard(crs);
      if (cachedData && Date.now() - new Date(cachedData.generatedAt).getTime() < 60000) {
        return res.json(cachedData);
      }
    }
    
    // Get fresh data from LDBWS
    const options = { filterCrs, filterType, timeOffset, timeWindow };
    const arrivalBoard = await ldbwsService.getArrBoardWithDetails(crs, numRows, options);
    
    // Save to database and return
    await dbService.saveStationBoard(arrivalBoard);
    res.json(arrivalBoard);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/stations/:crs/all
 * @desc Get combined arrival/departure board for a station
 * @access Private
 */
router.get('/:crs/all', auth, validateRequest, async (req, res, next) => {
  try {
    const { crs } = req.params;
    const { numRows = 10, filterCrs, filterType, timeOffset, timeWindow, refresh = false } = req.query;
    
    // Validate CRS code format
    if (!crs || !/^[A-Z]{3}$/.test(crs.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid CRS code' });
    }
    
    // Try to get from cache first if refresh is not requested
    if (!refresh) {
      const cachedData = await dbService.getLatestStationBoard(crs);
      if (cachedData && Date.now() - new Date(cachedData.generatedAt).getTime() < 60000) {
        return res.json(cachedData);
      }
    }
    
    // Get fresh data from LDBWS
    const options = { filterCrs, filterType, timeOffset, timeWindow };
    const combinedBoard = await ldbwsService.getArrivalDepartureBoard(crs, numRows, options);
    
    // Save to database and return
    await dbService.saveStationBoard(combinedBoard);
    res.json(combinedBoard);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/stations/:crs/all/details
 * @desc Get combined arrival/departure board with details for a station
 * @access Private
 */
router.get('/:crs/all/details', auth, validateRequest, async (req, res, next) => {
  try {
    const { crs } = req.params;
    const { numRows = 10, filterCrs, filterType, timeOffset, timeWindow, refresh = false } = req.query;
    
    // Validate CRS code format
    if (!crs || !/^[A-Z]{3}$/.test(crs.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid CRS code' });
    }
    
    // Try to get from cache first if refresh is not requested
    if (!refresh) {
      const cachedData = await dbService.getLatestStationBoard(crs);
      if (cachedData && Date.now() - new Date(cachedData.generatedAt).getTime() < 60000) {
        return res.json(cachedData);
      }
    }
    
    // Get fresh data from LDBWS
    const options = { filterCrs, filterType, timeOffset, timeWindow };
    const combinedBoard = await ldbwsService.getArrDepBoardWithDetails(crs, numRows, options);
    
    // Save to database and return
    await dbService.saveStationBoard(combinedBoard);
    res.json(combinedBoard);
  } catch (error) {
    next(error);
  }
});

module.exports = router;