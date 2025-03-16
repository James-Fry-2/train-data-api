// dev-utils/token-generator.js
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// Load config
const { JWT_SECRET, JWT_EXPIRY } = require('../src/config/api');

const generateToken = (userId = 'dev-123', role = 'admin') => {
  const payload = {
    id: userId,
    role: role,
    isAdmin: role === 'admin',
    isInspector: role === 'admin' || role === 'inspector',
    dev: true
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY || '7d' });
};

// Generate several types of tokens
const tokens = {
  admin: generateToken('admin-user', 'admin'),
  inspector: generateToken('inspector-user', 'inspector'),
  user: generateToken('regular-user', 'user')
};

// Output to console
console.log('=== DEVELOPMENT JWT TOKENS ===');
Object.entries(tokens).forEach(([role, token]) => {
  console.log(`\n${role.toUpperCase()} TOKEN:`);
  console.log(token);
});

// Save to a file for convenience
const outputPath = path.join(__dirname, 'dev-tokens.json');
fs.writeFileSync(outputPath, JSON.stringify(tokens, null, 2));
console.log(`\nTokens saved to: ${outputPath}`);