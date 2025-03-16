// utils/validators.js
/**
 * Validate incoming API requests
 */
exports.validateRequest = (req, res, next) => {
    // CRS code validation
    if (req.params.crs) {
      const crs = req.params.crs.toUpperCase();
      if (!/^[A-Z]{3}$/.test(crs)) {
        return res.status(400).json({ error: 'Invalid CRS code format' });
      }
      req.params.crs = crs;
    }
    
    // numRows validation
    if (req.query.numRows) {
      const numRows = parseInt(req.query.numRows);
      if (isNaN(numRows) || numRows < 1 || numRows > 150) {
        return res.status(400).json({ error: 'numRows must be between 1 and 150' });
      }
      req.query.numRows = numRows;
    }
    
    // timeOffset validation
    if (req.query.timeOffset) {
      const timeOffset = parseInt(req.query.timeOffset);
      if (isNaN(timeOffset) || timeOffset < -120 || timeOffset > 120) {
        return res.status(400).json({ error: 'timeOffset must be between -120 and 120' });
      }
      req.query.timeOffset = timeOffset;
    }
    
    // timeWindow validation
    if (req.query.timeWindow) {
      const timeWindow = parseInt(req.query.timeWindow);
      if (isNaN(timeWindow) || timeWindow < -120 || timeWindow > 120) {
        return res.status(400).json({ error: 'timeWindow must be between -120 and 120' });
      }
      req.query.timeWindow = timeWindow;
    }
    
    // Service ID validation
    if (req.params.serviceId && typeof req.params.serviceId !== 'string') {
      return res.status(400).json({ error: 'Invalid service ID' });
    }
    
    // Ticket reference validation
    if (req.params.reference && typeof req.params.reference !== 'string') {
      return res.status(400).json({ error: 'Invalid ticket reference' });
    }
    
    // User ID validation
    if (req.params.userId && typeof req.params.userId !== 'string') {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    // Destinations validation
    if (req.query.destinations) {
      // If destinations is a string, convert to array
      if (typeof req.query.destinations === 'string') {
        req.query.destinations = req.query.destinations.split(',').map(d => d.trim().toUpperCase());
      }
      
      // Validate array
      if (Array.isArray(req.query.destinations)) {
        // Check each destination is a valid CRS code
        const invalidDestinations = req.query.destinations.filter(d => !/^[A-Z]{3}$/.test(d));
        if (invalidDestinations.length > 0) {
          return res.status(400).json({ 
            error: 'Invalid destination CRS code format', 
            invalidItems: invalidDestinations 
          });
        }
      } else {
        return res.status(400).json({ error: 'Destinations must be a comma-separated list of CRS codes' });
      }
    }
    
    // FilterType validation
    if (req.query.filterType && !['from', 'to'].includes(req.query.filterType)) {
      return res.status(400).json({ error: 'filterType must be either "from" or "to"' });
    }
    
    // FilterCrs validation
    if (req.query.filterCrs) {
      const filterCrs = req.query.filterCrs.toUpperCase();
      if (!/^[A-Z]{3}$/.test(filterCrs)) {
        return res.status(400).json({ error: 'Invalid filterCrs code format' });
      }
      req.query.filterCrs = filterCrs;
    }
    
    // Refresh parameter validation
    if (req.query.refresh) {
      const refresh = req.query.refresh.toLowerCase();
      req.query.refresh = ['true', '1', 'yes'].includes(refresh);
    }
    
    // Limit and skip validation for pagination
    if (req.query.limit) {
      const limit = parseInt(req.query.limit);
      if (isNaN(limit) || limit < 1) {
        return res.status(400).json({ error: 'limit must be a positive integer' });
      }
      req.query.limit = limit;
    }
    
    if (req.query.skip) {
      const skip = parseInt(req.query.skip);
      if (isNaN(skip) || skip < 0) {
        return res.status(400).json({ error: 'skip must be a non-negative integer' });
      }
      req.query.skip = skip;
    }
    
    next();
  };
  
  /**
   * Validate ticket scan data
   * @param {Object} scanData - Ticket scan data to validate
   * @returns {Object} Validation result { valid: boolean, errors: string[] }
   */
  exports.validateTicketScan = (scanData) => {
    const errors = [];
    
    // Check required fields
    if (!scanData.userId) {
      errors.push('userId is required');
    }
    
    if (!scanData.ticketType) {
      errors.push('ticketType is required');
    }
    
    if (!scanData.ticketReference) {
      errors.push('ticketReference is required');
    }
    
    // Validate dates if present
    if (scanData.validFrom && isNaN(new Date(scanData.validFrom).getTime())) {
      errors.push('validFrom must be a valid date');
    }
    
    if (scanData.validTo && isNaN(new Date(scanData.validTo).getTime())) {
      errors.push('validTo must be a valid date');
    }
    
    // Validate CRS codes if present
    if (scanData.originCrs && !/^[A-Z]{3}$/.test(scanData.originCrs.toUpperCase())) {
      errors.push('originCrs must be a valid 3-letter CRS code');
    }
    
    if (scanData.destinationCrs && !/^[A-Z]{3}$/.test(scanData.destinationCrs.toUpperCase())) {
      errors.push('destinationCrs must be a valid 3-letter CRS code');
    }
    
    // Validate scan location
    if (scanData.scanLocation) {
      if (scanData.scanLocation.crs && !/^[A-Z]{3}$/.test(scanData.scanLocation.crs.toUpperCase())) {
        errors.push('scanLocation.crs must be a valid 3-letter CRS code');
      }
      
      if (scanData.scanLocation.coordinates) {
        const { latitude, longitude } = scanData.scanLocation.coordinates;
        
        if (latitude && (isNaN(latitude) || latitude < -90 || latitude > 90)) {
          errors.push('scanLocation.coordinates.latitude must be between -90 and 90');
        }
        
        if (longitude && (isNaN(longitude) || longitude < -180 || longitude > 180)) {
          errors.push('scanLocation.coordinates.longitude must be between -180 and 180');
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  };