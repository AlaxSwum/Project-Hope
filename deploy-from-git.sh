#!/bin/bash

# Hope IMS Git-based Production Deployment Script
# Usage: ./deploy-from-git.sh [git-repo-url] [branch]

set -e  # Exit on any error

# Configuration
SERVER_HOST="195.35.1.75"
SERVER_USER="root"
REMOTE_PATH="/var/www/hope-ims"
GIT_REPO="${1:-https://github.com/your-username/hope-ims.git}"  # Replace with your actual repo
BRANCH="${2:-main}"

echo "🚀 Starting Hope IMS git deployment to $SERVER_HOST"
echo "📦 Repository: $GIT_REPO"
echo "🌿 Branch: $BRANCH"

# Step 1: Test SSH connection
echo "🔍 Testing SSH connection..."
if ! ssh -o ConnectTimeout=10 $SERVER_USER@$SERVER_HOST "echo 'SSH connection successful'"; then
    echo "❌ Error: Cannot connect to server $SERVER_HOST"
    exit 1
fi

# Step 2: Deploy from git
echo "🚀 Deploying from git repository..."
ssh $SERVER_USER@$SERVER_HOST << ENDSSH
set -e

echo "📁 Setting up deployment directory..."
mkdir -p $REMOTE_PATH
cd $REMOTE_PATH

# Install git if not present
if ! command -v git &> /dev/null; then
    echo "📦 Installing git..."
    apt-get update
    apt-get install -y git
fi

# Install Node.js if not present
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

# Clone or update repository
if [ -d ".git" ]; then
    echo "🔄 Updating existing repository..."
    git fetch origin
    git reset --hard origin/$BRANCH
    git pull origin $BRANCH
else
    echo "📥 Cloning repository..."
    git clone $GIT_REPO .
    git checkout $BRANCH
fi

echo "📦 Repository updated successfully!"
echo "📋 Latest commit: \$(git log -1 --oneline)"

# Navigate to frontend directory
cd frontend

# Create production environment file if it doesn't exist
if [ ! -f ".env.production" ]; then
    echo "📝 Creating production environment file..."
    cat > .env.production << 'EOF'
# Hope IMS Production Environment Configuration
# IMPORTANT: Update all values below with your production settings

# Application URLs
NEXT_PUBLIC_APP_URL=http://195.35.1.75
NEXTAUTH_URL=http://195.35.1.75

# Supabase Configuration
# Get these from your Supabase project settings
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Authentication Secret
# Generate with: openssl rand -base64 32
NEXTAUTH_SECRET=your-32-character-secret-key-here

# Production Environment
NODE_ENV=production

# Feature Flags
NEXT_PUBLIC_ENABLE_NOTIFICATIONS=true
NEXT_PUBLIC_ENABLE_DARK_MODE=true
NEXT_PUBLIC_ENABLE_ANALYTICS=false

# Optional Services
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=
EOF

    echo "⚠️  IMPORTANT: Please edit /var/www/hope-ims/frontend/.env.production with your actual production values!"
    echo "⏸️  Pausing deployment for environment configuration..."
    echo "📝 Edit the file with: nano /var/www/hope-ims/frontend/.env.production"
    echo "🔑 Generate NEXTAUTH_SECRET with: openssl rand -base64 32"
    echo ""
    echo "Press Enter after you've configured the environment file to continue..."
    read
fi

# Stop existing service if running
echo "🛑 Stopping existing service (if running)..."
systemctl stop hope-ims || true

# Clear existing build and dependencies
echo "🧹 Cleaning previous build..."
rm -rf .next node_modules

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --only=production

# Build the application
echo "🏗️  Building Next.js application..."
npm run build

# Create start script
cat > start.sh << 'EOF'
#!/bin/bash
# Hope IMS Start Script

export NODE_ENV=production
cd /var/www/hope-ims/frontend

# Start the application
echo "Starting Hope IMS..."
npm start
EOF

chmod +x start.sh

# Create systemd service file
cat > ../hope-ims.service << 'EOF'
[Unit]
Description=Hope IMS Application
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/hope-ims/frontend
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PATH=/usr/bin:/usr/local/bin
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Set proper permissions
echo "🔒 Setting permissions..."
chown -R www-data:www-data /var/www/hope-ims

# Install systemd service
echo "⚙️  Installing systemd service..."
cp ../hope-ims.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable hope-ims

# Setup Nginx if not already configured
if [ ! -f "/etc/nginx/sites-available/hope-ims" ]; then
    echo "🌐 Setting up Nginx..."
    
    # Install Nginx if not present
    if ! command -v nginx &> /dev/null; then
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

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }

    # Health check endpoint
    location /api/health {
        proxy_pass http://localhost:3000/api/health;
        access_log off;
    }

    # Static assets caching
    location /_next/static/ {
        proxy_pass http://localhost:3000;
        add_header Cache-Control "public, immutable, max-age=31536000";
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
fi

echo "✅ Application setup complete!"
ENDSSH

# Step 3: Start the application
echo "🚀 Starting Hope IMS service..."
ssh $SERVER_USER@$SERVER_HOST "systemctl start hope-ims"

# Step 4: Verify deployment
echo "🔍 Verifying deployment..."
sleep 10

echo "📊 Service status:"
ssh $SERVER_USER@$SERVER_HOST "systemctl status hope-ims --no-pager -l"

echo ""
echo "🏥 Testing health endpoint..."
if ssh $SERVER_USER@$SERVER_HOST "curl -f -s http://localhost:3000/api/health" 2>/dev/null; then
    echo "✅ Health check passed!"
else
    echo "⚠️  Health check failed - checking logs..."
    ssh $SERVER_USER@$SERVER_HOST "journalctl -u hope-ims --no-pager -n 20"
fi

echo ""
echo "🎉 Git deployment completed!"
echo ""
echo "📋 Post-deployment info:"
echo "🌐 Application: http://$SERVER_HOST"
echo "🏥 Health check: http://$SERVER_HOST/api/health"
echo "📁 Deployed from: $GIT_REPO (branch: $BRANCH)"
echo ""
echo "📊 Management commands:"
echo "   View logs: ssh $SERVER_USER@$SERVER_HOST 'journalctl -u hope-ims -f'"
echo "   Check status: ssh $SERVER_USER@$SERVER_HOST 'systemctl status hope-ims'"
echo "   Restart: ssh $SERVER_USER@$SERVER_HOST 'systemctl restart hope-ims'"
echo ""
echo "🔄 To redeploy latest changes:"
echo "   ./deploy-from-git.sh $GIT_REPO $BRANCH"