// services/dbService.js
const StationBoard = require('../models/stationBoard');
const ServiceDetails = require('../models/serviceDetails');
const UserScan = require('../models/userScan');

class DatabaseService {
  /**
   * Save station board data to database
   * @param {Object} boardData - Station board data from LDBWS
   * @returns {Promise<Object>} Saved station board document
   */
  async saveStationBoard(boardData) {
    try {
      const { crs, generatedAt } = boardData;
      
      // Check if we already have a recent board for this station
      const existingBoard = await StationBoard.findOne({
        crs,
        generatedAt: {
          $gte: new Date(Date.now() - 5 * 60 * 1000) // Within last 5 minutes
        }
      });
      
      if (existingBoard) {
        return existingBoard;
      }
      
      // Create new board document
      const stationBoard = new StationBoard({
        ...boardData,
        timestamp: new Date(),
      });
      
      return await stationBoard.save();
    } catch (error) {
      console.error('Error saving station board:', error);
      throw error;
    }
  }

  /**
   * Get latest station board from database
   * @param {string} crs - Station CRS code
   * @returns {Promise<Object>} Station board document
   */
  async getLatestStationBoard(crs) {
    try {
      return await StationBoard.findOne({ crs: crs.toUpperCase() })
        .sort({ generatedAt: -1 })
        .lean();
    } catch (error) {
      console.error('Error retrieving station board:', error);
      throw error;
    }
  }

  /**
   * Save service details to database
   * @param {Object} serviceData - Service details from LDBWS
   * @returns {Promise<Object>} Saved service details document
   */
  async saveServiceDetails(serviceData) {
    try {
      const { serviceID, generatedAt } = serviceData;
      
      // Check if we already have a recent record for this service
      const existingService = await ServiceDetails.findOne({
        serviceID,
        generatedAt: {
          $gte: new Date(Date.now() - 5 * 60 * 1000) // Within last 5 minutes
        }
      });
      
      if (existingService) {
        return existingService;
      }
      
      // Create new service details document
      const serviceDetails = new ServiceDetails({
        ...serviceData,
        timestamp: new Date(),
      });
      
      return await serviceDetails.save();
    } catch (error) {
      console.error('Error saving service details:', error);
      throw error;
    }
  }

  /**
   * Get service details from database
   * @param {string} serviceId - Service ID
   * @returns {Promise<Object>} Service details document
   */
  async getServiceDetails(serviceId) {
    try {
      return await ServiceDetails.findOne({ serviceID: serviceId })
        .sort({ generatedAt: -1 })
        .lean();
    } catch (error) {
      console.error('Error retrieving service details:', error);
      throw error;
    }
  }

  /**
   * Record a ticket scan from a user
   * @param {Object} scanData - Scan data including user ID, ticket details, etc.
   * @returns {Promise<Object>} Saved scan record
   */
  async recordTicketScan(scanData) {
    try {
      const userScan = new UserScan({
        ...scanData,
        scanTimestamp: new Date(),
      });
      
      return await userScan.save();
    } catch (error) {
      console.error('Error recording ticket scan:', error);
      throw error;
    }
  }

  /**
   * Get user's scan history
   * @param {string} userId - User ID
   * @param {Object} options - Query options (limit, sort, etc.)
   * @returns {Promise<Array>} Array of scan records
   */
  async getUserScans(userId, options = {}) {
    const { limit = 50, skip = 0 } = options;
    
    try {
      return await UserScan.find({ userId })
        .sort({ scanTimestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
    } catch (error) {
      console.error('Error retrieving user scans:', error);
      throw error;
    }
  }
  
  /**
   * Get ticket scans by reference number
   * @param {string} ticketReference - Ticket reference number
   * @returns {Promise<Array>} Array of ticket scan records
   */
  async getTicketScansByReference(ticketReference) {
    try {
      return await UserScan.find({ ticketReference })
        .sort({ scanTimestamp: -1 })
        .lean();
    } catch (error) {
      console.error('Error retrieving ticket scans:', error);
      throw error;
    }
  }
  
  /**
   * Delete old board data to maintain database size
   * @param {number} daysToKeep - Number of days of data to retain
   * @returns {Promise<Object>} Deletion results
   */
  async cleanupOldBoardData(daysToKeep = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    try {
      const stationBoardResult = await StationBoard.deleteMany({
        timestamp: { $lt: cutoffDate }
      });
      
      const serviceDetailsResult = await ServiceDetails.deleteMany({
        timestamp: { $lt: cutoffDate }
      });
      
      return {
        stationBoards: stationBoardResult.deletedCount,
        serviceDetails: serviceDetailsResult.deletedCount
      };
    } catch (error) {
      console.error('Error cleaning up old data:', error);
      throw error;
    }
  }
}

module.exports = new DatabaseService();