// services/ticketParserService.js
const axios = require('axios');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const util = require('util');
const execPromise = util.promisify(exec);

const PYTHON_SCRIPT_PATH = process.env.TICKET_PARSER_PATH || path.join(__dirname, '../../scripts/identify_ticket_details.py');
const PARSER_API_URL = process.env.TICKET_PARSER_API || 'http://localhost:5000/parse-ticket';
const USE_API = process.env.USE_TICKET_PARSER_API === 'true';

class TicketParserService {
  /**
   * Parse ticket data from an image file
   * @param {Buffer|string} imageData - Image data as buffer or path to file
   * @returns {Promise<Object>} Parsed ticket information
   */
  async parseTicketImage(imageData) {
    try {
      if (USE_API) {
        return await this._parseViaApi(imageData);
      } else {
        return await this._parseViaScript(imageData);
      }
    } catch (error) {
      console.error('Error parsing ticket:', error.message);
      throw new Error(`Failed to parse ticket: ${error.message}`);
    }
  }

  /**
   * Parse ticket via Python script (executing as subprocess)
   * @param {Buffer|string} imageData - Image data
   * @returns {Promise<Object>} Parsed ticket information
   */
  async _parseViaScript(imageData) {
    // Create a temporary file if imageData is a buffer
    let tempFilePath = null;
    let filePath = imageData;

    if (Buffer.isBuffer(imageData)) {
      tempFilePath = path.join('/tmp', `ticket_${Date.now()}.jpg`);
      await fs.promises.writeFile(tempFilePath, imageData);
      filePath = tempFilePath;
    }

    try {
      // Execute the Python script
      const { stdout, stderr } = await execPromise(`python3 ${PYTHON_SCRIPT_PATH} --file "${filePath}"`);
      
      if (stderr) {
        console.warn('Python script stderr:', stderr);
      }
      
      // Parse the JSON output
      const ticketData = JSON.parse(stdout);
      return ticketData;
    } finally {
      // Clean up temporary file if created
      if (tempFilePath) {
        try {
          await fs.promises.unlink(tempFilePath);
        } catch (err) {
          console.warn(`Failed to delete temporary file: ${err.message}`);
        }
      }
    }
  }

  /**
   * Parse ticket via HTTP API call to Python service
   * @param {Buffer|string} imageData - Image data
   * @returns {Promise<Object>} Parsed ticket information
   */
  async _parseViaApi(imageData) {
    const formData = new FormData();
    
    if (Buffer.isBuffer(imageData)) {
      // If imageData is a buffer, add it directly to form
      formData.append('file', imageData, { filename: 'ticket.jpg' });
    } else {
      // If imageData is a path, read the file and add to form
      const fileBuffer = await fs.promises.readFile(imageData);
      formData.append('file', fileBuffer, { filename: path.basename(imageData) });
    }
    
    // Send to Python API service
    const response = await axios.post(PARSER_API_URL, formData, {
      headers: {
        ...formData.getHeaders()
      }
    });
    
    return response.data;
  }

  /**
   * Validate and enhance ticket data
   * @param {Object} ticketData - Raw parsed ticket data
   * @returns {Object} Validated and enhanced ticket data
   */
  validateTicketData(ticketData) {
    const validatedData = { ...ticketData };
    
    // Check if we have the minimum required fields
    if (!validatedData.ticket_reference) {
      throw new Error('Could not extract ticket reference');
    }
    
    // Add any missing fields with default values
    if (!validatedData.ticket_type) {
      validatedData.ticket_type = 'unknown';
    }
    
    // Add additional fields that might be useful
    validatedData.processed_at = new Date().toISOString();
    validatedData.is_valid = true; // Assume valid unless specifically marked invalid
    
    return validatedData;
  }
}

module.exports = new TicketParserService();