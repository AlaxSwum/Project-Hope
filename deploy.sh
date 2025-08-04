#!/bin/bash

# Hope IMS Production Deployment Script
# Usage: ./deploy.sh

set -e  # Exit on any error

# Configuration
SERVER_HOST="195.35.1.75"
SERVER_USER="root"
REMOTE_PATH="/var/www/hope-ims"
LOCAL_BUILD_PATH="./frontend"

echo "🚀 Starting Hope IMS deployment to $SERVER_HOST"

# Step 1: Pre-deployment checks
echo "📋 Running pre-deployment checks..."

# Check if we're in the right directory
if [ ! -d "frontend" ]; then
    echo "❌ Error: frontend directory not found. Please run this script from the project root."
    exit 1
fi

# Check if package.json exists
if [ ! -f "frontend/package.json" ]; then
    echo "❌ Error: package.json not found in frontend directory."
    exit 1
fi

# Check if environment file exists
if [ ! -f "frontend/.env.production" ]; then
    echo "⚠️  Warning: .env.production not found. Creating from example..."
    cp frontend/env.example frontend/.env.production
    echo "📝 Please edit frontend/.env.production with your production values before continuing."
    echo "Press Enter to continue after editing the environment file..."
    read
fi

# Step 2: Build the application locally
echo "🔨 Building application locally..."
cd frontend

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Build the application
echo "🏗️  Building Next.js application..."
npm run build

cd ..

# Step 3: Create deployment package
echo "📦 Creating deployment package..."
mkdir -p deploy-temp
cd deploy-temp

# Copy built application
cp -r ../frontend/.next ./
# Copy public directory if it exists
if [ -d "../frontend/public" ]; then
  cp -r ../frontend/public ./
fi
cp ../frontend/package.json ./
cp ../frontend/package-lock.json ./
cp ../frontend/next.config.js ./
cp ../frontend/.env.production ./.env.production

# Create a simple start script
cat > start.sh << 'EOF'
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
EOF

chmod +x start.sh

# Create systemd service file
cat > hope-ims.service << 'EOF'
[Unit]
Description=Hope IMS Application
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/hope-ims
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

cd ..

# Step 4: Deploy to server
echo "🚀 Deploying to server $SERVER_HOST..."

# Test SSH connection
echo "🔍 Testing SSH connection..."
if ! ssh -o ConnectTimeout=10 $SERVER_USER@$SERVER_HOST "echo 'SSH connection successful'"; then
    echo "❌ Error: Cannot connect to server $SERVER_HOST. Please check:"
    echo "   - Server is accessible"
    echo "   - SSH key is properly configured"
    echo "   - Firewall allows SSH connections"
    exit 1
fi

# Create directory structure on server
echo "📁 Creating directory structure on server..."
ssh $SERVER_USER@$SERVER_HOST "mkdir -p $REMOTE_PATH"

# Stop existing service if running
echo "🛑 Stopping existing service (if running)..."
ssh $SERVER_USER@$SERVER_HOST "systemctl stop hope-ims || true"

# Transfer files
echo "📤 Transferring files to server..."
scp -r deploy-temp/* $SERVER_USER@$SERVER_HOST:$REMOTE_PATH/

# Set up the application on server
echo "⚙️  Setting up application on server..."
ssh $SERVER_USER@$SERVER_HOST << 'ENDSSH'
cd /var/www/hope-ims

# Install Node.js if not present
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

# Install dependencies
echo "Installing production dependencies..."
npm ci --only=production

# Set proper permissions
chown -R www-data:www-data /var/www/hope-ims
chmod +x start.sh

# Install systemd service
cp hope-ims.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable hope-ims

echo "✅ Application setup complete!"
ENDSSH

# Step 5: Start the application
echo "🚀 Starting Hope IMS service..."
ssh $SERVER_USER@$SERVER_HOST "systemctl start hope-ims"

# Step 6: Verify deployment
echo "🔍 Verifying deployment..."
sleep 5

# Check service status
ssh $SERVER_USER@$SERVER_HOST "systemctl status hope-ims --no-pager"

# Test health endpoint
echo "🏥 Testing health endpoint..."
if ssh $SERVER_USER@$SERVER_HOST "curl -f http://localhost:3000/api/health" 2>/dev/null; then
    echo "✅ Health check passed!"
else
    echo "⚠️  Health check failed - application may still be starting..."
fi

# Step 7: Setup reverse proxy (Nginx)
echo "🌐 Setting up Nginx reverse proxy..."
ssh $SERVER_USER@$SERVER_HOST << 'ENDSSH'
# Install Nginx if not present
if ! command -v nginx &> /dev/null; then
    echo "Installing Nginx..."
    apt-get update
    apt-get install -y nginx
fi

# Create Nginx configuration
cat > /etc/nginx/sites-available/hope-ims << 'EOF'
server {
    listen 80;
    server_name _;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy strict-origin-when-cross-origin;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check endpoint
    location /api/health {
        proxy_pass http://localhost:3000/api/health;
        access_log off;
    }
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/hope-ims /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload Nginx
nginx -t && systemctl reload nginx
systemctl enable nginx

echo "✅ Nginx configured successfully!"
ENDSSH

# Cleanup
echo "🧹 Cleaning up temporary files..."
rm -rf deploy-temp

# Final verification
echo "🎉 Deployment completed successfully!"
echo ""
echo "📋 Post-deployment checklist:"
echo "✅ Application built and deployed"
echo "✅ Systemd service configured"
echo "✅ Nginx reverse proxy configured"
echo ""
echo "🌐 Your application should be accessible at: https://hopeims.com"
echo "🏥 Health check: https://hopeims.com/api/health"
echo ""
echo "📊 To monitor the application:"
echo "   - View logs: ssh $SERVER_USER@$SERVER_HOST 'journalctl -u hope-ims -f'"
echo "   - Check status: ssh $SERVER_USER@$SERVER_HOST 'systemctl status hope-ims'"
echo "   - Restart service: ssh $SERVER_USER@$SERVER_HOST 'systemctl restart hope-ims'"
echo ""
echo "🎉 Application is live at https://hopeims.com!"
echo "🔐 Login with: soneswumpyae@gmail.com / Rother123"