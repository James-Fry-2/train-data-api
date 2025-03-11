// routes/scans.js
const express = require('express');
const router = express.Router();
const dbService = require('../services/dbService');
const { validateRequest } = require('../utils/validators');
const auth = require('../middleware/auth');

/**
 * @route POST /api/scans
 * @desc Record a new ticket scan
 * @access Private
 */
router.post('/', auth, validateRequest, async (req, res, next) => {
  try {
    const scanData = req.body;
    
    // Validate required fields
    if (!scanData.userId || !scanData.ticketType || !scanData.ticketReference) {
      return res.status(400).json({ 
        error: 'Missing required fields: userId, ticketType, and ticketReference are required' 
      });
    }
    
    // Record the scan
    const savedScan = await dbService.recordTicketScan(scanData);
    
    res.status(201).json(savedScan);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/scans/user/:userId
 * @desc Get scan history for a user
 * @access Private
 */
router.get('/user/:userId', auth, validateRequest, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { limit, skip } = req.query;
    
    const options = {
      limit: parseInt(limit) || 50,
      skip: parseInt(skip) || 0
    };
    
    const scans = await dbService.getUserScans(userId, options);
    
    res.json({
      count: scans.length,
      total: scans.length + options.skip, // Approximate total - would be better to do a count query
      scans: scans
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/scans/ticket/:reference
 * @desc Get scan history for a specific ticket
 * @access Private
 */
router.get('/ticket/:reference', auth, validateRequest, async (req, res, next) => {
  try {
    const { reference } = req.params;
    
    const scans = await dbService.getTicketScansByReference(reference);
    
    res.json({
      count: scans.length,
      scans: scans
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/scans/stats
 * @desc Get scanning statistics
 * @access Private (Admin)
 */
router.get('/stats', auth, async (req, res, next) => {
  try {
    // This would be better implemented with MongoDB aggregation
    // For now, this is a placeholder for future implementation
    
    res.json({
      message: 'Statistics feature not yet implemented',
      todo: 'Implement MongoDB aggregation for scan statistics'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;