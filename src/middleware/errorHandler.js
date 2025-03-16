// middleware/errorHandler.js
/**
 * Global error handling middleware
 */
module.exports = (err, req, res, next) => {
    console.error(err.stack);
    
    // Format specific errors
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation Error',
        details: err.message
      });
    }
    
    if (err.name === 'MongoError' && err.code === 11000) {
      return res.status(409).json({
        error: 'Duplicate Resource',
        details: 'A resource with that identifier already exists'
      });
    }
  
    // Handle multer errors
    if (err.name === 'MulterError') {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: 'File Too Large',
          details: 'Uploaded file exceeds the maximum allowed size'
        });
      }
      return res.status(400).json({
        error: 'File Upload Error',
        details: err.message
      });
    }
    
    // LDBWS API errors
    if (err.response && err.response.data) {
      return res.status(err.response.status || 500).json({
        error: 'External API Error',
        details: err.response.data
      });
    }
    
    // Default error response
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    
    res.status(statusCode).json({
      error: message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  };