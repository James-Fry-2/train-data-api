// app.js (update the MongoDB connection part)
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
const stationDataRouter = require('./routes/stationData'); 
const errorHandler = require('./middleware/errorHandler');
const { DB_URI, DB_OPTIONS, testMongoConnection } = require('./config/database');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB using the recommended approach
async function startServer() {
  try {
    // Test the connection first
    const connectionSuccessful = await testMongoConnection();
    
    if (connectionSuccessful) {
      // Connect with Mongoose if test was successful
      await mongoose.connect(DB_URI, DB_OPTIONS);
      console.log('Connected to MongoDB with Mongoose');
      
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
            stationData: '/api/station-data' // Add the new endpoint
          },
          docs: '/docs',
          health: '/health'
        });
      });
      
      // Error handling
      app.use(errorHandler);
      
      // Find an available port and start server
      const server = app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
      
      // Handle graceful shutdown
      process.on('SIGTERM', () => {
        console.log('SIGTERM signal received: closing HTTP server');
        server.close(() => {
          console.log('HTTP server closed');
          mongoose.connection.close(false, () => {
            console.log('MongoDB connection closed');
            process.exit(0);
          });
        });
      });
    } else {
      console.error('Failed to start server due to MongoDB connection issues');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

module.exports = app;