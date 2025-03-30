class DeviceMotionService {
    constructor() {
      this.isCollecting = false;
      this.motionData = [];
      this.accelerometerHandler = null;
    }
    
    /**
     * Start collecting motion data from device sensors
     */
    startCollecting() {
      if (this.isCollecting) return;
      
      this.isCollecting = true;
      this.motionData = [];
      
      // Check if DeviceMotionEvent is available
      if (typeof DeviceMotionEvent !== 'undefined') {
        this.accelerometerHandler = (event) => {
          const timestamp = Date.now();
          
          // Get acceleration data including gravity
          const acceleration = {
            x: event.accelerationIncludingGravity.x,
            y: event.accelerationIncludingGravity.y,
            z: event.accelerationIncludingGravity.z,
            timestamp
          };
          
          this.motionData.push(acceleration);
          
          // Trim data to avoid excessive memory usage
          if (this.motionData.length > 1000) {
            this.motionData = this.motionData.slice(-1000);
          }
        };
        
        // Add event listener
        window.addEventListener('devicemotion', this.accelerometerHandler);
      }
    }
    
    /**
     * Stop collecting motion data
     */
    stopCollecting() {
      if (!this.isCollecting) return;
      
      this.isCollecting = false;
      
      if (this.accelerometerHandler) {
        window.removeEventListener('devicemotion', this.accelerometerHandler);
        this.accelerometerHandler = null;
      }
    }
    
    /**
     * Analyze collected motion data for train patterns
     * @returns {Object} Analysis results
     */
    analyzeMotionForTrainCharacteristics() {
      if (this.motionData.length < 50) {
        return { isTrainMotion: false, confidence: 0, reason: "Insufficient motion data" };
      }
      
      // Extract magnitude of acceleration for analysis
      const magnitudes = this.motionData.map(data => 
        Math.sqrt(data.x*data.x + data.y*data.y + data.z*data.z)
      );
      
      // Calculate metrics
      const avgMagnitude = this._calculateAverage(magnitudes);
      const magVariation = this._calculateStandardDeviation(magnitudes);
      
      // Frequency analysis for train-specific vibration patterns
      const frequencyData = this._performFrequencyAnalysis(magnitudes);
      
      // Train motion has characteristic low-frequency vibrations
      // with occasional regular patterns from track segments
      
      let trainConfidence = 0;
      let reason = "";
      
      // Check for consistent low-level vibration (characteristic of trains)
      if (magVariation > 0.05 && magVariation < 0.5) {
        trainConfidence += 0.3;
        reason += "Vibration pattern consistent with train. ";
      }
      
      // Check for periodic motion from train tracks
      if (frequencyData.hasPeriodicity && 
          frequencyData.dominantFrequency > 0.5 && 
          frequencyData.dominantFrequency < 5) {
        trainConfidence += 0.4;
        reason += "Periodic motion indicates train tracks. ";
      }
      
      // Smooth overall motion (trains are smoother than cars)
      if (frequencyData.smoothnessScore > 0.7) {
        trainConfidence += 0.2;
        reason += "Overall motion smoothness consistent with rail travel. ";
      }
      
      const isTrainMotion = trainConfidence > 0.5;
      
      return {
        isTrainMotion,
        confidence: trainConfidence,
        reason,
        metrics: {
          avgMagnitude,
          magVariation,
          dominantFrequency: frequencyData.dominantFrequency,
          smoothnessScore: frequencyData.smoothnessScore
        }
      };
    }
    
    /**
     * Perform basic frequency analysis on motion data
     * @private
     */
    _performFrequencyAnalysis(magnitudes) {
      // Simple autocorrelation to find periodicity
      // In a real implementation, you would use FFT or similar
      
      // Calculate autocorrelation
      const maxLag = Math.floor(magnitudes.length / 3);
      const autocorr = [];
      
      for (let lag = 0; lag < maxLag; lag++) {
        let sum = 0;
        for (let i = 0; i < magnitudes.length - lag; i++) {
          sum += magnitudes[i] * magnitudes[i + lag];
        }
        autocorr.push(sum);
      }
      
      // Find peaks in autocorrelation
      let peakLag = 0;
      let peakValue = 0;
      for (let i = 1; i < autocorr.length - 1; i++) {
        if (autocorr[i] > autocorr[i-1] && autocorr[i] > autocorr[i+1] && autocorr[i] > peakValue) {
          peakLag = i;
          peakValue = autocorr[i];
        }
      }
      
      // Calculate dominant frequency
      // Assuming data sampling rate of 10Hz (typical for device motion events)
      const samplingRate = 10; // Hz
      const dominantFrequency = peakLag > 0 ? samplingRate / peakLag : 0;
      
      // Calculate a smoothness score (0-1)
      // Lower frequency components indicate smoother motion
      let smoothnessScore = 0;
      if (dominantFrequency > 0) {
        smoothnessScore = Math.min(1, 2 / dominantFrequency);
      }
      
      return {
        hasPeriodicity: peakLag > 0 && peakValue > autocorr[0] * 0.2,
        dominantFrequency,
        smoothnessScore
      };
    }
    
    // Helper methods as in previous class
    _calculateAverage(array) { /* ... */ }
    _calculateStandardDeviation(array) { /* ... */ }
  }