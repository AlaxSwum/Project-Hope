#!/bin/bash
# Hope IMS Start Script

# Set environment
export NODE_ENV=production

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm ci --only=production
fi

# Start the application
echo "Starting Hope IMS..."
npm start
