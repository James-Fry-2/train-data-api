// services/ldbwsService.js
const axios = require('axios');
const { API_KEY, BASE_URL } = require('../config/api');

class LDBWSService {
  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
    });
  }

  /**
   * Get departure board for a station
   * @param {string} crs - CRS code of the station (3 letter code)
   * @param {number} numRows - Number of services to return (1-150)
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Station board data
   */
  async getDepartureBoard(crs, numRows = 10, options = {}) {
    const { filterCrs, filterType, timeOffset, timeWindow } = options;
    
    try {
      const response = await this.client.get('/GetDepartureBoard', {
        params: {
          numRows,
          crs: crs.toUpperCase(), // Ensure CRS is uppercase as per docs
          filterCrs: filterCrs?.toUpperCase(),
          filterType,
          timeOffset,
          timeWindow,
        },
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching departure board:', error.message);
      throw error;
    }
  }

  /**
   * Get departure board with detailed calling points
   * @param {string} crs - CRS code of the station
   * @param {number} numRows - Number of services to return (1-10)
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Station board data with details
   */
  async getDepBoardWithDetails(crs, numRows = 10, options = {}) {
    const { filterCrs, filterType, timeOffset, timeWindow } = options;
    
    try {
      const response = await this.client.get('/GetDepBoardWithDetails', {
        params: {
          numRows,
          crs: crs.toUpperCase(),
          filterCrs: filterCrs?.toUpperCase(),
          filterType,
          timeOffset,
          timeWindow,
        },
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching departure board with details:', error.message);
      throw error;
    }
  }

  /**
   * Get arrival board for a station
   * @param {string} crs - CRS code of the station
   * @param {number} numRows - Number of services to return
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Station board data
   */
  async getArrivalBoard(crs, numRows = 10, options = {}) {
    const { filterCrs, filterType, timeOffset, timeWindow } = options;
    
    try {
      const response = await this.client.get('/GetArrivalBoard', {
        params: {
          numRows,
          crs: crs.toUpperCase(),
          filterCrs: filterCrs?.toUpperCase(),
          filterType,
          timeOffset,
          timeWindow,
        },
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching arrival board:', error.message);
      throw error;
    }
  }
  
  /**
   * Get arrival board with detailed calling points
   * @param {string} crs - CRS code of the station
   * @param {number} numRows - Number of services to return (1-10)
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Station board data with details
   */
  async getArrBoardWithDetails(crs, numRows = 10, options = {}) {
    const { filterCrs, filterType, timeOffset, timeWindow } = options;
    
    try {
      const response = await this.client.get('/GetArrBoardWithDetails', {
        params: {
          numRows,
          crs: crs.toUpperCase(),
          filterCrs: filterCrs?.toUpperCase(),
          filterType,
          timeOffset,
          timeWindow,
        },
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching arrival board with details:', error.message);
      throw error;
    }
  }

  /**
   * Get both arrivals and departures for a station
   * @param {string} crs - CRS code of the station
   * @param {number} numRows - Number of services to return
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Station board data
   */
  async getArrivalDepartureBoard(crs, numRows = 10, options = {}) {
    const { filterCrs, filterType, timeOffset, timeWindow } = options;
    
    try {
      const response = await this.client.get('/GetArrivalDepartureBoard', {
        params: {
          numRows,
          crs: crs.toUpperCase(),
          filterCrs: filterCrs?.toUpperCase(),
          filterType,
          timeOffset,
          timeWindow,
        },
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching arrival/departure board:', error.message);
      throw error;
    }
  }
  
  /**
   * Get arrival/departure board with details
   * @param {string} crs - CRS code of the station
   * @param {number} numRows - Number of services to return (1-10)
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Station board data with details
   */
  async getArrDepBoardWithDetails(crs, numRows = 10, options = {}) {
    const { filterCrs, filterType, timeOffset, timeWindow } = options;
    
    try {
      const response = await this.client.get('/GetArrDepBoardWithDetails', {
        params: {
          numRows,
          crs: crs.toUpperCase(),
          filterCrs: filterCrs?.toUpperCase(),
          filterType,
          timeOffset,
          timeWindow,
        },
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching arrival/departure board with details:', error.message);
      throw error;
    }
  }

  /**
   * Get detailed service information
   * @param {string} serviceId - Service ID to get details for
   * @returns {Promise<Object>} Service details
   */
  async getServiceDetails(serviceId) {
    try {
      const response = await this.client.get('/GetServiceDetails', {
        params: {
          serviceID: serviceId,
        },
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching service details:', error.message);
      throw error;
    }
  }

  /**
   * Get next departures for specific destinations
   * @param {string} crs - CRS code of the departure station
   * @param {string[]} destinations - Array of destination CRS codes
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Departures data
   */
  async getNextDepartures(crs, destinations = [], options = {}) {
    const { timeOffset, timeWindow } = options;
    
    if (!destinations.length || destinations.length > 25) {
      throw new Error('Must provide between 1 and 25 destinations');
    }
    
    try {
      const response = await this.client.get('/GetNextDepartures', {
        params: {
          crs: crs.toUpperCase(),
          filterList: destinations.map(d => d.toUpperCase()),
          timeOffset,
          timeWindow,
        },
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching next departures:', error.message);
      throw error;
    }
  }
  
  /**
   * Get next departures with details for specific destinations
   * @param {string} crs - CRS code of the departure station
   * @param {string[]} destinations - Array of destination CRS codes (max 10)
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Departures data with details
   */
  async getNextDeparturesWithDetails(crs, destinations = [], options = {}) {
    const { timeOffset, timeWindow } = options;
    
    if (!destinations.length || destinations.length > 10) {
      throw new Error('Must provide between 1 and 10 destinations');
    }
    
    try {
      const response = await this.client.get('/GetNextDeparturesWithDetails', {
        params: {
          crs: crs.toUpperCase(),
          filterList: destinations.map(d => d.toUpperCase()),
          timeOffset,
          timeWindow,
        },
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching next departures with details:', error.message);
      throw error;
    }
  }
  
  /**
   * Get fastest departures for specific destinations
   * @param {string} crs - CRS code of the departure station
   * @param {string[]} destinations - Array of destination CRS codes (max 15)
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Fastest departures data
   */
  async getFastestDepartures(crs, destinations = [], options = {}) {
    const { timeOffset, timeWindow } = options;
    
    if (!destinations.length || destinations.length > 15) {
      throw new Error('Must provide between 1 and 15 destinations');
    }
    
    try {
      const response = await this.client.get('/GetFastestDepartures', {
        params: {
          crs: crs.toUpperCase(),
          filterList: destinations.map(d => d.toUpperCase()),
          timeOffset,
          timeWindow,
        },
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching fastest departures:', error.message);
      throw error;
    }
  }
  
  /**
   * Get fastest departures with details for specific destinations
   * @param {string} crs - CRS code of the departure station
   * @param {string[]} destinations - Array of destination CRS codes (max 10)
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Fastest departures data with details
   */
  async getFastestDeparturesWithDetails(crs, destinations = [], options = {}) {
    const { timeOffset, timeWindow } = options;
    
    if (!destinations.length || destinations.length > 10) {
      throw new Error('Must provide between 1 and 10 destinations');
    }
    
    try {
      const response = await this.client.get('/GetFastestDeparturesWithDetails', {
        params: {
          crs: crs.toUpperCase(),
          filterList: destinations.map(d => d.toUpperCase()),
          timeOffset,
          timeWindow,
        },
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching fastest departures with details:', error.message);
      throw error;
    }
  }
}

module.exports = new LDBWSService();