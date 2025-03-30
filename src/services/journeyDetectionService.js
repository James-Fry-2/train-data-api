// services/journeyDetectionService.js
const StationMatchingService = require('./stationMatchingService');
const MotionAnalysisService = require('./motionAnalysisService');
const DeviceMotionService = require('./deviceMotionService');

class JourneyDetectionService {
  constructor() {
    this.stationService = new StationMatchingService();
    this.motionService = new MotionAnalysisService();
    this.deviceMotion = new DeviceMotionService();
    this.locationHistory = [];
  }
  
  /**
   * Process a new location update with motion analysis
   * @param {string} userId - User ID
   * @param {Object} locationData - Location data from device
   * @returns {Promise<Object>} Journey detection results
   */
  async processLocationUpdate(userId, locationData) {
    // Add to location history
    this.locationHistory.push({
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      timestamp: locationData.timestamp || Date.now(),
      speed: locationData.speed // If available from GPS
    });
    
    // Keep only the last 20 location updates
    if (this.locationHistory.length > 20) {
      this.locationHistory = this.locationHistory.slice(-20);
    }
    
    // 1. Check if user is at a station
    const stationResult = await this.stationService.recordStationVisit(userId, locationData);
    
    // 2. Analyze motion data for train characteristics
    const motionResult = this.motionService.analyzeJourneyType(this.locationHistory);
    
    // 3. Analyze device motion sensor data if available
    let deviceMotionResult = { confidence: 0 };
    if (this.deviceMotion.isCollecting) {
      deviceMotionResult = this.deviceMotion.analyzeMotionForTrainCharacteristics();
    }
    
    // 4. Combine all signals with weighted confidence
    const isTrainJourney = this._determineJourneyType(
      stationResult, 
      motionResult, 
      deviceMotionResult
    );
    
    return {
      userId,
      timestamp: Date.now(),
      location: {
        latitude: locationData.latitude,
        longitude: locationData.longitude
      },
      isAtStation: stationResult.isAtStation,
      stationInfo: stationResult.isAtStation ? {
        crs: stationResult.stationVisit.stationCrs,
        name: stationResult.stationVisit.stationName
      } : null,
      isTrainJourney: isTrainJourney.isTrainJourney,
      confidence: isTrainJourney.confidence,
      averageSpeed: motionResult.averageSpeed,
      serviceInfo: stationResult.identifiedService || null,
      analysis: {
        station: stationResult,
        motion: motionResult,
        deviceMotion: deviceMotionResult
      }
    };
  }
  
  /**
   * Start collecting detailed motion data
   */
  startMotionCollection() {
    this.deviceMotion.startCollecting();
  }
  
  /**
   * Stop collecting detailed motion data
   */
  stopMotionCollection() {
    this.deviceMotion.stopCollecting();
  }
  
  /**
   * Determine journey type by combining multiple signals
   * @private
   */
  _determineJourneyType(stationResult, motionResult, deviceMotionResult) {
    // Define weights for each signal type
    const weights = {
      station: 0.4,  // Station detection
      motion: 0.4,   // Location-based motion analysis
      device: 0.2    // Device sensor motion analysis
    };
    
    // Calculate station evidence
    let stationEvidence = 0;
    if (stationResult.isAtStation) {
      stationEvidence = 0.5; // Base evidence for being at a station
      
      if (stationResult.identifiedService) {
        stationEvidence += stationResult.identifiedService.confidence * 0.5;
      }
    }
    
    // Calculate weighted evidence
    const weightedConfidence = 
      (stationEvidence * weights.station) +
      (motionResult.confidence * weights.motion) +
      (deviceMotionResult.confidence * weights.device);
    
    // Decision threshold
    const isTrainJourney = weightedConfidence > 0.5;
    
    // Generate reason string
    let reason = '';
    if (stationResult.isAtStation) {
      reason += `At station ${stationResult.stationVisit.stationName}. `;
    }
    
    if (motionResult.reason) {
      reason += motionResult.reason + ' ';
    }
    
    if (deviceMotionResult.reason) {
      reason += deviceMotionResult.reason;
    }
    
    return {
      isTrainJourney,
      confidence: weightedConfidence,
      reason: reason.trim()
    };
  }
}