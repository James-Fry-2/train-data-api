// scripts/test-roi-debugging.js
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const ticketParserService = require('../services/ticketParserService');

// Enable ROI debugging for testing
process.env.ENABLE_ROI_DEBUG = 'true';
process.env.ROI_DEBUG_DIR = path.join(__dirname, '../../debug_roi_images');

/**
 * Test the ticket parser with ROI debugging enabled
 */
async function testRoiDebugging() {
  if (process.argv.length < 3) {
    console.error('Please provide an image path!');
    console.error('Usage: node test-roi-debugging.js <path_to_image>');
    process.exit(1);
  }

  const imagePath = process.argv[2];
  console.log(`Testing ROI debugging with image: ${imagePath}`);

  // Check if file exists
  if (!fs.existsSync(imagePath)) {
    console.error(`File not found: ${imagePath}`);
    process.exit(1);
  }

  try {
    // Create debug directory if it doesn't exist
    if (!fs.existsSync(process.env.ROI_DEBUG_DIR)) {
      fs.mkdirSync(process.env.ROI_DEBUG_DIR, { recursive: true });
    }

    // Parse the ticket with ROI debugging enabled
    console.log('Parsing ticket...');
    const result = await ticketParserService.parseTicketImage(imagePath);
    
    // Validate the data
    const validatedData = ticketParserService.validateTicketData(result);
    
    // Print the results
    console.log('\nParsing Results:');
    console.log(JSON.stringify(validatedData, null, 2));
    
    console.log('\nROI debug images saved to:', process.env.ROI_DEBUG_DIR);
    
    // List the generated debug files
    const debugFiles = fs.readdirSync(process.env.ROI_DEBUG_DIR);
    console.log(`\nGenerated ${debugFiles.length} debug files:`);
    
    // Group files by type
    const filesByType = {
      'ROI Images': [],
      'Text Files': [],
      'Other Files': []
    };
    
    debugFiles.forEach(file => {
      if (file.includes('roi_')) {
        filesByType['ROI Images'].push(file);
      } else if (file.endsWith('.txt') || file.endsWith('.json')) {
        filesByType['Text Files'].push(file);
      } else {
        filesByType['Other Files'].push(file);
      }
    });
    
    // Print files by type
    for (const [type, files] of Object.entries(filesByType)) {
      if (files.length > 0) {
        console.log(`\n${type} (${files.length}):`);
        files.forEach(file => console.log(`  - ${file}`));
      }
    }
    
  } catch (error) {
    console.error('Error testing ROI debugging:', error);
  }
}

testRoiDebugging();