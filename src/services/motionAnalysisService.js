class MotionAnalysisService {
    /**
     * Analyze motion data to determine if user is on a train
     * @param {Array} locationUpdates - Array of location points with timestamps
     * @returns {Object} Analysis results with confidence score
     */
    analyzeJourneyType(locationUpdates) {
      if (locationUpdates.length < 3) {
        return { isTrainJourney: false, confidence: 0, reason: "Insufficient data points" };
      }
      
      // Calculate speeds between consecutive points
      const speeds = [];
      const accelerations = [];
      
      for (let i = 1; i < locationUpdates.length; i++) {
        const current = locationUpdates[i];
        const previous = locationUpdates[i-1];
        
        // Time difference in seconds
        const timeDiff = (current.timestamp - previous.timestamp) / 1000;
        
        if (timeDiff <= 0) continue; // Skip invalid time differences
        
        // Distance in meters
        const distance = this._calculateDistance(
          previous.latitude, previous.longitude,
          current.latitude, current.longitude
        );
        
        // Speed in meters per second
        const speed = distance / timeDiff;
        speeds.push(speed);
        
        // Calculate acceleration if possible
        if (i > 1) {
          const prevSpeed = speeds[speeds.length - 2];
          const acceleration = (speed - prevSpeed) / timeDiff;
          accelerations.push(acceleration);
        }
      }
      
      // Convert to km/h for easier interpretation
      const speedsKmh = speeds.map(s => s * 3.6);
      
      // Calculate metrics
      const avgSpeed = this._calculateAverage(speedsKmh);
      const maxSpeed = Math.max(...speedsKmh);
      const minSpeed = Math.min(...speedsKmh);
      const speedVariation = this._calculateStandardDeviation(speedsKmh);
      const avgAcceleration = this._calculateAverage(accelerations);
      const accelerationVariation = this._calculateStandardDeviation(accelerations);
      
      // Analyze for train characteristics
      let trainConfidence = 0;
      let reason = "";
      
      // Speed range check for trains
      if (avgSpeed > 40 && avgSpeed < 250) {
        trainConfidence += 0.3;
        reason += "Average speed is within train range. ";
      } else if (avgSpeed > 30) {
        trainConfidence += 0.1;
        reason += "Average speed is possibly train. ";
      }
      
      // Maximum speed check
      if (maxSpeed > 80) {
        trainConfidence += 0.2;
        reason += "Maximum speed indicates train. ";
      }
      
      // Smooth acceleration/deceleration is characteristic of trains
      if (accelerationVariation < 0.2 && avgSpeed > 30) {
        trainConfidence += 0.2;
        reason += "Smooth acceleration pattern. ";
      }
      
      // Consistent speed over time (trains maintain speed between stations)
      const speedConsistencyRatio = speedVariation / avgSpeed;
      if (speedConsistencyRatio < 0.3 && avgSpeed > 40) {
        trainConfidence += 0.2;
        reason += "Consistent cruising speed. ";
      }
      
      // Check for typical train stop patterns
      if (this._hasTrainStopPattern(speedsKmh)) {
        trainConfidence += 0.1;
        reason += "Typical train station stop pattern. ";
      }
      
      const isTrainJourney = trainConfidence > 0.5;
      
      return {
        isTrainJourney,
        confidence: trainConfidence,
        averageSpeed: avgSpeed,
        maxSpeed,
        reason,
        metrics: {
          avgSpeed,
          maxSpeed,
          minSpeed,
          speedVariation,
          avgAcceleration,
          accelerationVariation,
          speedConsistencyRatio
        }
      };
    }
    
    /**
     * Calculate distance between two points using Haversine formula
     * @private
     */
    _calculateDistance(lat1, lon1, lat2, lon2) {
      const R = 6371000; // Earth radius in meters
      const φ1 = lat1 * Math.PI/180;
      const φ2 = lat2 * Math.PI/180;
      const Δφ = (lat2-lat1) * Math.PI/180;
      const Δλ = (lon2-lon1) * Math.PI/180;
  
      const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
      return R * c; // in meters
    }
    
    /**
     * Calculate average of an array
     * @private
     */
    _calculateAverage(array) {
      return array.reduce((a, b) => a + b, 0) / array.length;
    }
    
    /**
     * Calculate standard deviation
     * @private
     */
    _calculateStandardDeviation(array) {
      const avg = this._calculateAverage(array);
      const squareDiffs = array.map(value => {
        const diff = value - avg;
        return diff * diff;
      });
      const avgSquareDiff = this._calculateAverage(squareDiffs);
      return Math.sqrt(avgSquareDiff);
    }
    
    /**
     * Check if speed pattern resembles train stops
     * @private
     */
    _hasTrainStopPattern(speeds) {
      // Looking for periods of zero/low speed followed by 
      // acceleration to high speed, then sustained cruising
      
      let stoppedCount = 0;
      let highSpeedCount = 0;
      
      for (let i = 0; i < speeds.length; i++) {
        if (speeds[i] < 5) {
          stoppedCount++;
        } else if (speeds[i] > 50) {
          highSpeedCount++;
        }
      }
      
      // Expect at least one stop and significant high-speed travel
      return stoppedCount > 0 && highSpeedCount > speeds.length * 0.3;
    }
  }