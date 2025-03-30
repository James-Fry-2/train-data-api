// services/stationMatchingService.js
const Station = require('../models/station');
const StationVisit = require('../models/stationVisit');
const dbService = require('./dbService');

class StationMatchingService {
  /**
   * Record a user station visit and determine possible services
   * @param {string} userId - User identifier
   * @param {Object} location - Location coordinates {latitude, longitude}
   * @returns {Promise<Object>} Station visit record with possible services
   */
  async recordStationVisit(userId, location) {
    try {
      // Find the nearest station to the user's location
      const nearestStation = await this._findNearestStation(location.latitude, location.longitude);
      
      if (!nearestStation || nearestStation.distance > 0.2) { // If more than 200m away
        return { isAtStation: false };
      }
      
      // User is at a station - record the visit
      const visitRecord = {
        userId,
        timestamp: new Date(),
        stationCrs: nearestStation.crs,
        stationName: nearestStation.name,
        coordinates: location
      };
      
      // Get departures from this station
      const departureBoard = await this._fetchDepartures(nearestStation.crs);
      const arrivalBoard = await this._fetchArrivals(nearestStation.crs);
      
      // Store possible services
      visitRecord.possibleDepartures = this._formatServices(departureBoard?.trainServices || []);
      visitRecord.possibleArrivals = this._formatServices(arrivalBoard?.trainServices || []);
      
      // Save the station visit
      const savedVisit = await dbService.saveStationVisit(visitRecord);
      
      // Find previous station visits by this user
      const previousVisits = await dbService.getUserStationVisits(userId, 5);
      
      // If we have previous visits, try to determine the service used
      let identifiedService = null;
      if (previousVisits.length > 0) {
        identifiedService = await this._identifyServiceBetweenVisits(
          previousVisits[0], 
          visitRecord
        );
        
        if (identifiedService) {
          await dbService.recordServiceUsage({
            userId,
            serviceId: identifiedService.serviceId,
            operator: identifiedService.operator,
            originCrs: identifiedService.originCrs,
            originName: identifiedService.originName,
            destinationCrs: identifiedService.destinationCrs,
            destinationName: identifiedService.destinationName,
            departureTime: identifiedService.departureTime,
            arrivalTime: identifiedService.arrivalTime,
            confidence: identifiedService.confidence
          });
        }
      }
      
      return {
        isAtStation: true,
        stationVisit: savedVisit,
        identifiedService
      };
    } catch (error) {
      console.error('Error recording station visit:', error);
      throw error;
    }
  }
  
  /**
   * Find the nearest station to given coordinates
   * @private
   */
  async _findNearestStation(latitude, longitude) {
    try {
      const stations = await Station.find({
        'coordinates.latitude': { $exists: true, $ne: null },
        'coordinates.longitude': { $exists: true, $ne: null }
      }).limit(100);
      
      let nearestStation = null;
      let minDistance = Infinity;
      
      stations.forEach(station => {
        if (!station.coordinates.latitude || !station.coordinates.longitude) {
          return;
        }
        
        const distance = this._calculateDistance(
          latitude,
          longitude,
          station.coordinates.latitude,
          station.coordinates.longitude
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          nearestStation = {
            ...station.toObject(),
            distance
          };
        }
      });
      
      return nearestStation;
    } catch (error) {
      console.error('Error finding nearest station:', error);
      throw error;
    }
  }
  
  /**
   * Calculate distance between coordinates using Haversine formula
   * @private
   */
  _calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = this._deg2rad(lat2 - lat1);
    const dLon = this._deg2rad(lon2 - lon1);
    
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this._deg2rad(lat1)) * Math.cos(this._deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
  }
  
  _deg2rad(deg) {
    return deg * (Math.PI/180);
  }
  
  /**
   * Fetch departures from a station
   * @private
   */
  async _fetchDepartures(crs, numRows = 10) {
    try {
      const ldbwsService = require('./ldbwsService');
      return await ldbwsService.getDepartureBoard(crs, numRows);
    } catch (error) {
      console.error(`Error fetching departures for ${crs}:`, error);
      return null;
    }
  }
  
  /**
   * Fetch arrivals to a station
   * @private
   */
  async _fetchArrivals(crs, numRows = 10) {
    try {
      const ldbwsService = require('./ldbwsService');
      return await ldbwsService.getArrivalBoard(crs, numRows);
    } catch (error) {
      console.error(`Error fetching arrivals for ${crs}:`, error);
      return null;
    }
  }
  
  /**
   * Format train service data for storage
   * @private
   */
  _formatServices(services) {
    return services.map(service => ({
      serviceId: service.serviceID,
      std: service.std,
      etd: service.etd,
      sta: service.sta,
      eta: service.eta,
      platform: service.platform,
      operator: service.operator,
      operatorCode: service.operatorCode,
      origin: service.origin ? service.origin[0] : null,
      destination: service.destination ? service.destination[0] : null,
      isCancelled: service.isCancelled
    }));
  }
  
  /**
   * Identify the most likely service used between two station visits
   * @private
   */
  async _identifyServiceBetweenVisits(previousVisit, currentVisit) {
    // Calculate time between visits
    const timeBetweenVisits = new Date(currentVisit.timestamp) - new Date(previousVisit.timestamp);
    const minutesBetween = Math.floor(timeBetweenVisits / 60000);
    
    // Typical train journey is between 10 minutes and 3 hours
    if (minutesBetween < 10 || minutesBetween > 180) {
      return null; // Unlikely to be a direct train journey
    }
    
    const possibleServices = [];
    
    // Check departures from previous station
    for (const departure of previousVisit.possibleDepartures) {
      // Skip canceled services
      if (departure.isCancelled) continue;
      
      // Look for trains going to the current station
      if (departure.destination && 
          departure.destination.crs === currentVisit.stationCrs) {
        
        // Get scheduled departure time
        const depTime = this._parseTime(departure.std || '00:00');
        const depTimeMinutes = depTime.hours * 60 + depTime.minutes;
        
        // Calculate when the user was at the previous station relative to the departure
        const visitTime = new Date(previousVisit.timestamp);
        const visitTimeMinutes = visitTime.getHours() * 60 + visitTime.getMinutes();
        
        // User should be at the station before departure but not too early
        const minutesBeforeDeparture = depTimeMinutes - visitTimeMinutes;
        
        if (minutesBeforeDeparture >= -5 && minutesBeforeDeparture <= 30) {
          // This is a candidate service
          possibleServices.push({
            serviceId: departure.serviceId,
            operator: departure.operator,
            originCrs: previousVisit.stationCrs,
            originName: previousVisit.stationName,
            destinationCrs: currentVisit.stationCrs,
            destinationName: currentVisit.stationName,
            departureTime: this._combineDateTime(previousVisit.timestamp, departure.std),
            minutesBetweenStations: minutesBetween,
            confidence: 0.5 // Base confidence
          });
        }
      }
    }
    
    // Check arrivals at current station
    for (const arrival of currentVisit.possibleArrivals) {
      // Skip canceled services
      if (arrival.isCancelled) continue;
      
      // Look for trains coming from the previous station
      if (arrival.origin && 
          arrival.origin.crs === previousVisit.stationCrs) {
        
        // Get scheduled arrival time
        const arrTime = this._parseTime(arrival.sta || '00:00');
        const arrTimeMinutes = arrTime.hours * 60 + arrTime.minutes;
        
        // Calculate when the user was at the current station relative to the arrival
        const visitTime = new Date(currentVisit.timestamp);
        const visitTimeMinutes = visitTime.getHours() * 60 + visitTime.getMinutes();
        
        // User should be at the station after arrival but not too late
        const minutesAfterArrival = visitTimeMinutes - arrTimeMinutes;
        
        if (minutesAfterArrival >= -5 && minutesAfterArrival <= 30) {
          // This is a candidate service - check if it's already in our list
          const existingIndex = possibleServices.findIndex(
            s => s.serviceId === arrival.serviceId
          );
          
          if (existingIndex >= 0) {
            // Update the existing entry with arrival information
            possibleServices[existingIndex].arrivalTime = 
              this._combineDateTime(currentVisit.timestamp, arrival.sta);
            possibleServices[existingIndex].confidence += 0.3; // Higher confidence with matching arrival
          } else {
            // Add as a new possibility
            possibleServices.push({
              serviceId: arrival.serviceId,
              operator: arrival.operator,
              originCrs: previousVisit.stationCrs,
              originName: previousVisit.stationName,
              destinationCrs: currentVisit.stationCrs,
              destinationName: currentVisit.stationName,
              arrivalTime: this._combineDateTime(currentVisit.timestamp, arrival.sta),
              minutesBetweenStations: minutesBetween,
              confidence: 0.4 // Base confidence for arrival only
            });
          }
        }
      }
    }
    
    // Sort by confidence and return the most likely service
    possibleServices.sort((a, b) => b.confidence - a.confidence);
    return possibleServices.length > 0 ? possibleServices[0] : null;
  }
  
  /**
   * Parse time string into hours and minutes
   * @private
   */
  _parseTime(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return { hours: hours || 0, minutes: minutes || 0 };
  }
  
  /**
   * Combine a date and time string into a full datetime
   * @private
   */
  _combineDateTime(dateObj, timeStr) {
    if (!timeStr) return dateObj;
    
    const date = new Date(dateObj);
    const { hours, minutes } = this._parseTime(timeStr);
    
    date.setHours(hours, minutes, 0, 0);
    return date;
  }
}

module.exports = new StationMatchingService();