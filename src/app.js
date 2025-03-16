// Main application entry point
const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const stationsRouter = require('./routes/stations');
const servicesRouter = require('./routes/services');
const scansRouter = require('./routes/scans');
const ticketsRouter = require('./routes/tickets');
const stationDataRouter = require('./routes/stationData'); // Add the new route
const errorHandler = require('./middleware/errorHandler');
const { DB_URI } = require('./config/database');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect(DB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.use(helmet()); // Security headers
app.use(cors());   // Enable CORS
app.use(morgan('dev')); // Logging
app.use(express.json()); // Parse JSON bodies

// Routes
app.use('/api/stations', stationsRouter);
app.use('/api/services', servicesRouter);
app.use('/api/scans', scansRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/station-data', stationDataRouter); // Register the new route

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date() });
});

// API info endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Train Ticket Data API',
    version: process.env.npm_package_version || '1.0.0',
    endpoints: {
      stations: '/api/stations',
      services: '/api/services',
      scans: '/api/scans',
      tickets: '/api/tickets',
      stationData: '/api/station-data'
    },
    docs: '/docs',
    health: '/health'
  });
});

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;