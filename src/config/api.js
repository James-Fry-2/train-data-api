// config/api.js

require('dotenv').config();

module.exports = {
    // LDBWS API Configuration
    API_KEY: process.env.LDBWS_API_KEY,
    BASE_URL: process.env.LDBWS_BASE_URL || 'https://api.rail-data-marketplace.com/ldbws/v1',
    
    // JWT Configuration for Authentication
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRY: process.env.JWT_EXPIRY || '24h',
  };