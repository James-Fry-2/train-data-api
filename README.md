# Train Ticket Data API

An API for extracting data from train tickets, integrating with the Live Departure Boards Web Service (LDBWS), and storing information in a database.

## Features

- Ticket image scanning and data extraction using Python OCR
- Live train departure/arrival information via LDBWS
- Service details for specific trains
- User ticket scan management
- MongoDB data storage for persistence

## Architecture

The system consists of the following components:

- **Node.js API**: Express.js server handling all HTTP requests
- **Python Ticket Parser**: Service for extracting information from ticket images
- **MongoDB Database**: Storage for train service and ticket scan data

## Prerequisites

- Node.js 14.x or later
- Python 3.8 or later
- MongoDB 4.4 or later
- LDBWS API access credentials (from Rail Data Marketplace)

## Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/train-ticket-api.git
cd train-ticket-api
```

2. Install Node.js dependencies:

```bash
npm install
```

3. Install Python dependencies:

```bash
pip install -r scripts/requirements.txt
```

4. Configure environment variables:

Create a `.env` file in the root directory with the following variables:

```
# API Configuration
PORT=3000
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/train-ticket-api

# LDBWS API Configuration
LDBWS_API_KEY=your_api_key_here
LDBWS_BASE_URL=https://api.rail-data-marketplace.com/ldbws/v1

# Authentication
JWT_SECRET=your_secret_key_here
JWT_EXPIRY=24h

# Python Ticket Parser
TICKET_PARSER_PATH=./scripts/identify_ticket_details.py
USE_TICKET_PARSER_API=false
TICKET_PARSER_API=http://localhost:5000/parse-ticket
```

## Running the API

Start the API server:

```bash
npm start
```

For development with auto-restart:

```bash
npm run dev
```

If using the Python parser as a service:

```bash
# In a separate terminal
npm run start-ticket-parser
```

## API Endpoints

### Stations

- `GET /api/stations/:crs/departures` - Get departure board for a station
- `GET /api/stations/:crs/arrivals` - Get arrival board for a station
- `GET /api/stations/:crs/all` - Get combined arrival/departure board

### Services

- `GET /api/services/:serviceId` - Get details for a specific service
- `GET /api/services/next-departures/:crs` - Get next departures for specific destinations

### Ticket Scanning

- `POST /api/tickets/scan` - Scan a ticket image and extract information
- `GET /api/tickets/validate/:reference` - Validate a ticket by reference number

### User Scans

- `POST /api/scans` - Record a new ticket scan
- `GET /api/scans/user/:userId` - Get scan history for a user

## Authentication

All API endpoints require authentication via JWT tokens. Include the token in the Authorization header:

```
Authorization: Bearer your_jwt_token
```

## Development

Run linting:

```bash
npm run lint
```

Run tests:

```bash
npm test
```

## License

MIT