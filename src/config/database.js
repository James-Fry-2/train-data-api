// config/database.js
let certConfig = {};

// Check if certificate content is available in environment variables
if (process.env.MONGODB_CERT_CONTENT) {
  // Replace any escaped newlines with actual newlines
  const certContent = process.env.MONGODB_CERT_CONTENT.replace(/\\n/g, '\n');
  
  certConfig = {
    sslKey: Buffer.from(certContent),
    sslCert: Buffer.from(certContent)
  };
  
  // If you have a CA certificate in environment variables
  if (process.env.MONGODB_CA_CONTENT) {
    const caContent = process.env.MONGODB_CA_CONTENT.replace(/\\n/g, '\n');
    certConfig.sslCA = [Buffer.from(caContent)];
  }
}

module.exports = {
  DB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/train-ticket-api',
  DB_OPTIONS: {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    ...certConfig,
  }
};