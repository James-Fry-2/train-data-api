// services/ticketParserService.js
const axios = require('axios');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const util = require('util');
const execPromise = util.promisify(exec);

const PYTHON_SCRIPT_PATH = process.env.TICKET_PARSER_PATH || path.join(__dirname, '../../scripts/ticket_parsers/identify_ticket_details.py');
const PARSER_API_URL = process.env.TICKET_PARSER_API || 'http://localhost:5000/parse-ticket';
const USE_API = process.env.USE_TICKET_PARSER_API === 'true';
const ENABLE_ROI_DEBUG = process.env.ENABLE_ROI_DEBUG === 'true';
const ROI_DEBUG_DIR = process.env.ROI_DEBUG_DIR || path.join(__dirname, '../../debug_roi_images');

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
      tempFilePath = path.join(process.env.TEMP || '/tmp', `ticket_${Date.now()}.jpg`);
      await fs.promises.writeFile(tempFilePath, imageData);
      filePath = tempFilePath;
    }

    try {
      console.log('Image filepath:', filePath);
      console.log('Python filepath:', PYTHON_SCRIPT_PATH);

      // Prepare command with optional ROI debugging
      let command = `python "${PYTHON_SCRIPT_PATH}" "${filePath}"`;
      if (ENABLE_ROI_DEBUG) {
        // Make sure debug directory exists
        if (!fs.existsSync(ROI_DEBUG_DIR)) {
          await fs.promises.mkdir(ROI_DEBUG_DIR, { recursive: true });
        }
        command += ` --debug-roi --debug-dir "${ROI_DEBUG_DIR}"`;
      }

      // Execute the Python script
      const { stdout, stderr } = await execPromise(command);
      
      if (stderr) {
        console.warn('Python script stderr:', stderr);
      }
      
      console.log('Python script stdout:', stdout.substring(0, 200) + (stdout.length > 200 ? '...' : ''));
      
      try {
        // Parse the JSON output
        const ticketData = JSON.parse(stdout);
        
        // Flatten data structure if needed
        if (ticketData.data) {
          // Merge the nested data into the main object
          const result = {
            ...ticketData,
            ...ticketData.data
          };
          delete result.data; // Remove the nested data object
          return result;
        }
        
        return ticketData;
      } catch (jsonError) {
        console.error('JSON parse error:', jsonError.message);
        console.error('Raw output first 500 chars:', stdout.substring(0, 500));
        throw new Error(`Failed to parse ticket: ${jsonError.message}`);
      }
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
    
    // Add debug parameters if enabled
    if (ENABLE_ROI_DEBUG) {
      formData.append('debug_roi', 'true');
      formData.append('debug_dir', ROI_DEBUG_DIR);
    }
    
    try {
      // Send to Python API service
      const response = await axios.post(PARSER_API_URL, formData, {
        headers: {
          ...formData.getHeaders()
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('API error:', error.message);
      if (error.response) {
        console.error('API response:', error.response.data);
      }
      throw new Error(`Failed to parse ticket via API: ${error.message}`);
    }
  }

  /**
   * Validate and enhance ticket data
   * @param {Object} ticketData - Raw parsed ticket data
   * @returns {Object} Validated and enhanced ticket data
   */
  validateTicketData(ticketData) {
    const validatedData = { ...ticketData };
    
    // If data is nested in a data property, extract it
    if (validatedData.data) {
      Object.assign(validatedData, validatedData.data);
      delete validatedData.data;
    }
    
    // Generate a reference if missing
    if (!validatedData.ticket_reference) {
      console.log('Ticket reference not found, generating placeholder');
      // Create a reference from origin, destination and timestamp
      const timestamp = Date.now().toString().slice(-6);
      const origin = validatedData.origin_code || 
                    validatedData.origin_station || 
                    validatedData.originCrs || 
                    validatedData.originStation || 
                    'UNK';
      const dest = validatedData.destination_code || 
                  validatedData.destination_station || 
                  validatedData.destinationCrs || 
                  validatedData.destinationStation || 
                  'UNK';
      validatedData.ticket_reference = `${origin}-${dest}-${timestamp}`;
      validatedData.is_reference_generated = true;
    }
    
    // Normalize field names
    this._normalizeFieldNames(validatedData);
    
    // Add any missing fields with default values
    if (!validatedData.ticket_type) {
      validatedData.ticket_type = 'unknown';
    }
    
    // Add additional fields that might be useful
    validatedData.processed_at = new Date().toISOString();
    validatedData.is_valid = true; // Assume valid unless specifically marked invalid
    
    return validatedData;
  }
  
  /**
   * Normalize field names to ensure consistency
   * @param {Object} data - The data object to normalize
   * @private
   */
  _normalizeFieldNames(data) {
    // Map of possible field names to standardized names
    const fieldMappings = {
      // Origin fields
      'origin': 'origin_station',
      'originStation': 'origin_station',
      'originCrs': 'origin_code',
      'from': 'origin_station',
      
      // Destination fields
      'destination': 'destination_station',
      'destinationStation': 'destination_station',
      'destinationCrs': 'destination_code',
      'to': 'destination_station',
      
      // Date/time fields
      'valid_from': 'valid_from',
      'validFrom': 'valid_from',
      'valid_to': 'valid_to',
      'validTo': 'valid_to',
      'validDate': 'valid_date',
      'valid_date': 'valid_date',
      'date': 'valid_date',
      
      // Ticket fields
      'ticketType': 'ticket_type',
      'fare': 'ticket_type',
      'reference': 'ticket_reference',
      'ticketReference': 'ticket_reference',
      'ref': 'ticket_reference'
    };
    
    // Normalize fields based on mapping
    for (const [originalKey, normalizedKey] of Object.entries(fieldMappings)) {
      if (originalKey in data && originalKey !== normalizedKey) {
        data[normalizedKey] = data[originalKey];
        // Keep original for backward compatibility
      }
    }
  }
}

module.exports = new TicketParserService();