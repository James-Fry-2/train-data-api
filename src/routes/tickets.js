// routes/tickets.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const ticketParserService = require('../services/ticketParserService');
const dbService = require('../services/dbService');
const auth = require('../middleware/auth');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

/**
 * @route POST /api/tickets/scan
 * @desc Scan a ticket image and extract information
 * @access Private
 */
router.post('/scan', auth, upload.single('ticket'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No ticket image provided' });
    }

    // Extract user ID from auth token
    const userId = req.user.id;

    // Parse the ticket image
    const ticketData = await ticketParserService.parseTicketImage(req.file.buffer);
    
    // Validate the parsed data
    const validatedTicketData = ticketParserService.validateTicketData(ticketData);
    
    // Create scan record
    const scanData = {
      userId,
      ticketType: validatedTicketData.ticket_type,
      ticketReference: validatedTicketData.ticket_reference,
      validFrom: validatedTicketData.valid_from || validatedTicketData.valid_date,
      validTo: validatedTicketData.valid_to,
      originStation: validatedTicketData.origin_station,
      originCrs: validatedTicketData.origin_crs,
      destinationStation: validatedTicketData.destination_station,
      destinationCrs: validatedTicketData.destination_crs,
      scanLocation: {
        type: req.body.locationType || 'station',
        crs: req.body.locationCrs,
        coordinates: {
          latitude: req.body.latitude,
          longitude: req.body.longitude
        }
      },
      deviceId: req.body.deviceId,
      isValid: validatedTicketData.is_valid,
      rawData: validatedTicketData.raw_data || validatedTicketData.raw_text
    };
    
    // Save to database
    const savedScan = await dbService.recordTicketScan(scanData);
    
    res.status(201).json({
      message: 'Ticket scanned successfully',
      ticket: validatedTicketData,
      scan: savedScan
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/tickets/validate/:reference
 * @desc Validate a ticket by its reference number
 * @access Private
 */
router.get('/validate/:reference', auth, async (req, res, next) => {
  try {
    const { reference } = req.params;
    
    // Check if we have a record of this ticket
    const ticketScans = await dbService.getTicketScansByReference(reference);
    
    if (!ticketScans || ticketScans.length === 0) {
      return res.status(404).json({ 
        valid: false,
        message: 'Ticket not found in database' 
      });
    }
    
    // Check if the ticket is currently valid
    const latestScan = ticketScans[0]; // Assuming sorted by date desc
    const now = new Date();
    const validFrom = latestScan.validFrom ? new Date(latestScan.validFrom) : null;
    const validTo = latestScan.validTo ? new Date(latestScan.validTo) : null;
    
    let isValid = latestScan.isValid;
    let message = 'Ticket is valid';
    
    // Check date validity
    if (validFrom && validFrom > now) {
      isValid = false;
      message = 'Ticket is not yet valid';
    } else if (validTo && validTo < now) {
      isValid = false;
      message = 'Ticket has expired';
    }
    
    // Check if ticket has been marked as invalid for other reasons
    if (!isValid && latestScan.validationMessage) {
      message = latestScan.validationMessage;
    }
    
    res.json({
      valid: isValid,
      message,
      ticket: {
        reference: reference,
        type: latestScan.ticketType,
        originStation: latestScan.originStation,
        originCrs: latestScan.originCrs,
        destinationStation: latestScan.destinationStation,
        destinationCrs: latestScan.destinationCrs,
        validFrom: validFrom,
        validTo: validTo,
        lastScanned: latestScan.scanTimestamp
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/tickets/mark-invalid/:reference
 * @desc Mark a ticket as invalid (e.g., for ticket inspectors)
 * @access Private (Admin/Inspector only)
 */
router.post('/mark-invalid/:reference', auth, async (req, res, next) => {
  try {
    const { reference } = req.params;
    const { reason, userId } = req.body;
    
    // Check if user has inspector/admin privileges
    // This would be implemented in a real system
    // if (!req.user.isInspector && !req.user.isAdmin) {
    //   return res.status(403).json({ error: 'Unauthorized: Inspector or Admin privileges required' });
    // }
    
    // Get the latest scan for this ticket
    const ticketScans = await dbService.getTicketScansByReference(reference);
    
    if (!ticketScans || ticketScans.length === 0) {
      return res.status(404).json({ error: 'Ticket not found in database' });
    }
    
    // Create a new scan record marking the ticket as invalid
    const scanData = {
      userId: userId || req.user.id,
      ticketType: ticketScans[0].ticketType,
      ticketReference: reference,
      validFrom: ticketScans[0].validFrom,
      validTo: ticketScans[0].validTo,
      originStation: ticketScans[0].originStation,
      originCrs: ticketScans[0].originCrs,
      destinationStation: ticketScans[0].destinationStation,
      destinationCrs: ticketScans[0].destinationCrs,
      isValid: false,
      validationMessage: reason || 'Ticket marked as invalid by inspector',
      scanLocation: req.body.scanLocation || {
        type: 'station',
        crs: req.body.locationCrs
      },
      deviceId: req.body.deviceId
    };
    
    // Save to database
    const savedScan = await dbService.recordTicketScan(scanData);
    
    res.status(200).json({
      message: 'Ticket marked as invalid',
      ticket: reference,
      reason: scanData.validationMessage,
      scan: savedScan
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;