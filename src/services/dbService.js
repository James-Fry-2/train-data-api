const StationVisit = require('../models/stationVisit');
const ServiceUsage = require('../models/serviceUsage');
const UserLocation = require('../models/userLocation');
const Station = require('../models/station');

class DatabaseService {
  /**
   * Save station visit data to database
   * @param {Object} visitData - Station visit data
   * @returns {Promise<Object>} Saved station visit document
   */
  async saveStationVisit(visitData) {
    try {
      const stationVisit = new StationVisit(visitData);
      return await stationVisit.save();
    } catch (error) {
      console.error('Error saving station visit:', error);
      throw error;
    }
  }

  /**
   * Get user's station visits
   * @param {string} userId - User ID
   * @param {number} limit - Maximum number of records to return
   * @returns {Promise<Array>} Array of station visit records
   */
  async getUserStationVisits(userId, limit = 5) {
    try {
      return await StationVisit.find({ userId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();
    } catch (error) {
      console.error('Error retrieving station visits:', error);
      throw error;
    }
  }

  /**
   * Record service usage by a user
   * @param {Object} serviceData - Service usage data
   * @returns {Promise<Object>} Saved service usage document
   */
  async recordServiceUsage(serviceData) {
    try {
      // Add journey date if not provided
      if (!serviceData.journeyDate && serviceData.departureTime) {
        const date = new Date(serviceData.departureTime);
        serviceData.journeyDate = date.toISOString().slice(0, 10); // YYYY-MM-DD
      }
      
      const serviceUsage = new ServiceUsage(serviceData);
      return await serviceUsage.save();
    } catch (error) {
      console.error('Error recording service usage:', error);
      throw error;
    }
  }

  /**
   * Save user location data
   * @param {Object} locationData - User location data
   * @returns {Promise<Object>} Saved location document
   */
  async saveUserLocation(locationData) {
    try {
      const userLocation = new UserLocation(locationData);
      return await userLocation.save();
    } catch (error) {
      console.error('Error saving user location:', error);
      throw error;
    }
  }

  /**
   * Get user's location history between two timestamps
   * @param {string} userId - User ID
   * @param {Date} startTime - Start time
   * @param {Date} endTime - End time
   * @returns {Promise<Array>} Array of location records
   */
  async getUserLocationHistory(userId, startTime, endTime) {
    try {
      return await UserLocation.find({
        userId,
        timestamp: { $gte: startTime, $lte: endTime }
      })
        .sort({ timestamp: 1 })
        .lean();
    } catch (error) {
      console.error('Error retrieving location history:', error);
      throw error;
    }
  }

  /**
   * Get user's service usage history
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of service usage records
   */
  async getUserServiceHistory(userId, options = {}) {
    const { limit = 10, skip = 0, startDate, endDate } = options;
    
    const query = { userId };
    
    if (startDate || endDate) {
      query.departureTime = {};
      if (startDate) query.departureTime.$gte = new Date(startDate);
      if (endDate) query.departureTime.$lte = new Date(endDate);
    }
    
    try {
      return await ServiceUsage.find(query)
        .sort({ departureTime: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
    } catch (error) {
      console.error('Error retrieving service history:', error);
      throw error;
    }
  }
  
  // Additional database methods...
}

module.exports = new DatabaseService();