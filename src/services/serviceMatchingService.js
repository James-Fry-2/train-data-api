// services/serviceMatchingService.js
const ldbwsService = require('./ldbwsService');
const dbService = require('./dbService');
const MotionAnalysisService = require('./motionAnalysisService');
const motionService = new MotionAnalysisService();

class ServiceMatchingService {
  /**
   * Match a user's journey to a specific train service
   * @param {string} userId - User identifier
   * @param {Array} stationVisits - Array of user's station visits
   * @param {Array} locationUpdates - Array of location updates between stations
   * @returns {Promise<Object>} Matched service with confidence score
   */
  async matchService(userId, stationVisits, locationUpdates) {
    try {
      if (stationVisits.length < 2) {
        return { 
          matched: false, 
          reason: "Insufficient station visits to identify a journey" 
        };
      }
      
      // Sort visits by timestamp
      stationVisits.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      // Get the origin and destination stations
      const originVisit = stationVisits[0];
      const destinationVisit = stationVisits[stationVisits.length - 1];
      
      // Analyze motion data for journey segments
      const motionAnalysis = await this._analyzeMotionData(locationUpdates);
      
      // Check if motion patterns match train travel
      if (!motionAnalysis.isTrainJourney) {
        return {
          matched: false,
          reason: "Motion patterns do not match train travel",
          confidence: motionAnalysis.confidence,
          analysis: motionAnalysis
        };
      }
      
      // Find possible services between origin and destination
      const candidateServices = await this._findCandidateServices(
        originVisit,
        destinationVisit,
        stationVisits.slice(1, -1) // Intermediate stops
      );
      
      if (candidateServices.length === 0) {
        return {
          matched: false,
          reason: "No train services found matching the journey pattern",
          analysis: { originVisit, destinationVisit }
        };
      }
      
      // Calculate confidence scores for each candidate
      const scoredCandidates = this._calculateServiceConfidence(
        candidateServices,
        stationVisits,
        motionAnalysis
      );
      
      // Sort by confidence score
      scoredCandidates.sort((a, b) => b.confidence - a.confidence);
      
      // Select the most likely service
      const bestMatch = scoredCandidates[0];
      
      // Only consider it a match if confidence is high enough
      if (bestMatch.confidence < 0.5) {
        return {
          matched: false,
          reason: "Low confidence in service match",
          bestCandidate: bestMatch,
          allCandidates: scoredCandidates
        };
      }
      
      // Record the matched service
      await this._recordServiceUsage(userId, bestMatch);
      
      return {
        matched: true,
        service: bestMatch,
        confidence: bestMatch.confidence,
        alternatives: scoredCandidates.slice(1)
      };
    } catch (error) {
      console.error('Error matching service:', error);
      throw error;
    }
  }
  
  /**
   * Analyze motion data to verify train journey
   * @private
   */
  async _analyzeMotionData(locationUpdates) {
    // Use the motion analysis service to analyze the location updates
    return await motionService.analyzeJourneyType(locationUpdates);
  }
  
  /**
   * Find candidate services between origin and destination
   * @private
   */
  async _findCandidateServices(originVisit, destinationVisit, intermediateVisits = []) {
    const candidates = [];
    
    try {
      // Get departures from origin station
      const departures = await ldbwsService.getDepartureBoard(
        originVisit.stationCrs, 
        20, // Increase number to get more potential matches
        { 
          timeOffset: this._calculateTimeOffset(originVisit.timestamp),
          timeWindow: 60 // Look at departures within a 60-minute window
        }
      );
      
      if (!departures || !departures.trainServices || departures.trainServices.length === 0) {
        return candidates;
      }
      
      // Filter for services heading to the destination
      for (const service of departures.trainServices) {
        // Get detailed service information
        try {
          const serviceDetails = await ldbwsService.getServiceDetails(service.serviceID);
          
          // Check if this service stops at the destination
          const stopsAtDestination = this._serviceStopsAt(
            serviceDetails, 
            destinationVisit.stationCrs
          );
          
          if (stopsAtDestination) {
            // Check if it also stops at intermediate stations
            const matchesIntermediateStops = this._matchesIntermediateStops(
              serviceDetails,
              intermediateVisits
            );
            
            candidates.push({
              serviceId: service.serviceID,
              operator: service.operator,
              operatorCode: service.operatorCode,
              originCrs: originVisit.stationCrs,
              originName: originVisit.stationName,
              destinationCrs: destinationVisit.stationCrs,
              destinationName: destinationVisit.stationName,
              departureTime: this._parseScheduledTime(service.std, originVisit.timestamp),
              arrivalTime: this._extractArrivalTime(serviceDetails, destinationVisit.stationCrs),
              intermediateStopsMatch: matchesIntermediateStops,
              serviceDetails: serviceDetails
            });
          }
        } catch (err) {
          console.error(`Error getting details for service ${service.serviceID}:`, err);
          // Continue with next service
        }
      }
      
      return candidates;
    } catch (error) {
      console.error('Error finding candidate services:', error);
      return [];
    }
  }
  
  /**
   * Check if a service stops at a specific station
   * @private
   */
  _serviceStopsAt(serviceDetails, stationCrs) {
    if (!serviceDetails || !serviceDetails.subsequentCallingPoints) {
      return false;
    }
    
    // Check all calling point lists (there might be multiple for trains that split)
    for (const callingPointList of serviceDetails.subsequentCallingPoints) {
      if (!callingPointList.callingPoint) continue;
      
      for (const callingPoint of callingPointList.callingPoint) {
        if (callingPoint.crs === stationCrs) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Check if service matches intermediate stops
   * @private
   */
  _matchesIntermediateStops(serviceDetails, intermediateVisits) {
    if (intermediateVisits.length === 0) {
      return true; // No intermediate stops to match
    }
    
    // Convert to set of CRS codes for faster lookup
    const intermediateStations = new Set(
      intermediateVisits.map(visit => visit.stationCrs)
    );
    
    // Track which intermediate stations are found in the calling points
    const foundStations = new Set();
    
    // Check all calling point lists
    if (serviceDetails.subsequentCallingPoints) {
      for (const callingPointList of serviceDetails.subsequentCallingPoints) {
        if (!callingPointList.callingPoint) continue;
        
        for (const callingPoint of callingPointList.callingPoint) {
          if (intermediateStations.has(callingPoint.crs)) {
            foundStations.add(callingPoint.crs);
          }
        }
      }
    }
    
    // Calculate match ratio
    const matchRatio = foundStations.size / intermediateStations.size;
    return matchRatio >= 0.5; // At least half of intermediate stations must match
  }
  
  /**
   * Calculate service confidence scores
   * @private
   */
  _calculateServiceConfidence(candidates, stationVisits, motionAnalysis) {
    return candidates.map(candidate => {
      let confidence = 0.5; // Base confidence
      
      // Factor 1: Timing alignment with station visits
      const timingScore = this._calculateTimingScore(candidate, stationVisits);
      confidence += timingScore * 0.3; // Timing is worth 30% of confidence
      
      // Factor 2: Motion analysis alignment
      const motionScore = this._calculateMotionScore(candidate, motionAnalysis);
      confidence += motionScore * 0.2; // Motion is worth 20% of confidence
      
      // Factor 3: Intermediate stops match
      if (candidate.intermediateStopsMatch) {
        confidence += 0.15; // Bonus for matching intermediate stops
      }
      
      // Cap confidence at 1.0
      confidence = Math.min(1.0, confidence);
      
      return {
        ...candidate,
        confidence,
        confidenceFactors: {
          timingScore,
          motionScore,
          intermediateStopsMatch: candidate.intermediateStopsMatch
        }
      };
    });
  }
  
  /**
   * Calculate how well service timing aligns with user's station visits
   * @private
   */
  _calculateTimingScore(candidate, stationVisits) {
    let score = 0;
    
    // Origin timing score
    const originVisit = stationVisits[0];
    const originTimeDiff = Math.abs(
      new Date(candidate.departureTime) - new Date(originVisit.timestamp)
    ) / 60000; // Convert to minutes
    
    if (originTimeDiff < 5) score += 0.5;
    else if (originTimeDiff < 15) score += 0.3;
    else if (originTimeDiff < 30) score += 0.1;
    
    // Destination timing score
    const destVisit = stationVisits[stationVisits.length - 1];
    if (candidate.arrivalTime) {
      const destTimeDiff = Math.abs(
        new Date(candidate.arrivalTime) - new Date(destVisit.timestamp)
      ) / 60000; // Convert to minutes
      
      if (destTimeDiff < 5) score += 0.5;
      else if (destTimeDiff < 15) score += 0.3;
      else if (destTimeDiff < 30) score += 0.1;
    }
    
    return score / 2; // Normalize to 0-1 range
  }
  
  /**
   * Calculate how well motion data aligns with service characteristics
   * @private
   */
  _calculateMotionScore(candidate, motionAnalysis) {
    // Start with the basic train confidence from motion analysis
    let score = motionAnalysis.confidence;
    
    // Additional factors could be considered here:
    // - Average speed matching expected train speeds for this route
    // - Acceleration patterns matching train type
    // - Stop durations matching expected station dwell times
    
    return score;
  }
  
  /**
   * Record the service usage in the database
   * @private
   */
  async _recordServiceUsage(userId, serviceMatch) {
    try {
      return await dbService.recordServiceUsage({
        userId,
        serviceId: serviceMatch.serviceId,
        operator: serviceMatch.operator,
        operatorCode: serviceMatch.operatorCode,
        originCrs: serviceMatch.originCrs,
        originName: serviceMatch.originName,
        destinationCrs: serviceMatch.destinationCrs,
        destinationName: serviceMatch.destinationName,
        departureTime: serviceMatch.departureTime,
        arrivalTime: serviceMatch.arrivalTime,
        confidence: serviceMatch.confidence,
        journeyDate: new Date(serviceMatch.departureTime).toISOString().slice(0, 10)
      });
    } catch (error) {
      console.error('Error recording service usage:', error);
      throw error;
    }
  }
  
  /**
   * Calculate time offset in minutes from now
   * @private
   */
  _calculateTimeOffset(timestamp) {
    const now = new Date();
    const targetTime = new Date(timestamp);
    return Math.floor((targetTime - now) / 60000); // Convert to minutes
  }
  
  /**
   * Parse scheduled time string into Date object
   * @private
   */
  _parseScheduledTime(timeStr, baseDate) {
    if (!timeStr) return null;
    
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date(baseDate);
    date.setHours(hours, minutes, 0, 0);
    
    return date;
  }
  
  /**
   * Extract arrival time at destination from service details
   * @private
   */
  _extractArrivalTime(serviceDetails, destinationCrs) {
    if (!serviceDetails || !serviceDetails.subsequentCallingPoints) {
      return null;
    }
    
    for (const callingPointList of serviceDetails.subsequentCallingPoints) {
      if (!callingPointList.callingPoint) continue;
      
      for (const callingPoint of callingPointList.callingPoint) {
        if (callingPoint.crs === destinationCrs && callingPoint.st) {
          // Create date from the scheduled time at the destination
          const baseDate = new Date(serviceDetails.generatedAt);
          const [hours, minutes] = callingPoint.st.split(':').map(Number);
          
          const arrivalDate = new Date(baseDate);
          arrivalDate.setHours(hours, minutes, 0, 0);
          
          // Handle cases where the arrival is on the next day
          if (arrivalDate < baseDate) {
            arrivalDate.setDate(arrivalDate.getDate() + 1);
          }
          
          return arrivalDate;
        }
      }
    }
    
    return null;
  }
}

module.exports = new ServiceMatchingService();