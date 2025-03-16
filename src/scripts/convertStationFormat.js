// scripts/convertStationFormat.js
const fs = require('fs');
const path = require('path');

/**
 * Converts station data from GitHub format to our internal format.
 * This is useful for testing or if you want to preprocess the data.
 */
async function convertStationFormat() {
  try {
    // Read input file (adjust path as needed)
    const inputPath = path.join(__dirname, '../data/stations.json');
    const outputPath = path.join(__dirname, '../data/stations-converted.json');

    console.log(`Reading from ${inputPath}`);
    const rawData = await fs.promises.readFile(inputPath, 'utf8');
    const stations = JSON.parse(rawData);

    console.log(`Processing ${stations.length} stations...`);

    // Convert to our format
    const convertedStations = stations.map(station => ({
      name: station.stationName || station.name,
      crs: (station.crsCode || station.crs || '').toUpperCase(),
      stationOperator: station.operator || station.stationOperator || 'Unknown',
      coordinates: {
        latitude: station.lat || station.latitude,
        longitude: station.long || station.longitude
      },
      // Preserve original data
      stationName: station.stationName,
      crsCode: station.crsCode,
      lat: station.lat,
      long: station.long,
      
      // Add empty fields that our schema expects
      address: '',
      postcode: '',
      facilities: {},
      fastestServices: []
    }));

    // Write output file
    await fs.promises.writeFile(
      outputPath,
      JSON.stringify(convertedStations, null, 2),
      'utf8'
    );

    console.log(`Successfully converted ${convertedStations.length} stations`);
    console.log(`Output written to ${outputPath}`);
  } catch (error) {
    console.error('Error converting station format:', error);
  }
}

// Run the conversion
convertStationFormat();