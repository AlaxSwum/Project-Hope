#!/bin/bash

# Quick CORS Fix Script for Hope IMS
echo "🔧 Fixing CORS issue for Hope IMS..."

# Method 1: Update the environment to add CORS headers
echo "📝 Adding CORS configuration to Next.js..."

ssh root@195.35.1.75 << 'ENDSSH'
cd /var/www/hope-ims

# Check if next.config.js has CORS headers
if ! grep -q "Access-Control-Allow-Origin" next.config.js; then
    echo "Adding CORS headers to next.config.js..."
    
    # Backup the original file
    cp next.config.js next.config.js.backup
    
    # Add CORS headers
    cat > next.config.js << 'EOF'
/** @type {import('next').NextConfig} */
const { withSentryConfig } = require('@sentry/nextjs');

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // Add CORS headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, apikey',
          },
        ],
      },
    ];
  },

  // Existing configuration
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  
  images: {
    domains: ['localhost'],
  },

  // Webpack configuration for better builds
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Important: return the modified config
    return config;
  },

  // Experimental features
  experimental: {
    // Enable modern CSS features
    scrollRestoration: true,
  },

  // Security headers
  poweredByHeader: false,
  
  // Compression
  compress: true,

  // Redirects and rewrites
  async redirects() {
    return [
      {
        source: '/home',
        destination: '/',
        permanent: true,
      },
    ];
  },

  // API routes configuration
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: '/api/:path*',
      },
    ];
  },
};

// Sentry configuration
const sentryWebpackPluginOptions = {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
};

module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions);
EOF

    echo "✅ CORS headers added to next.config.js"
else
    echo "ℹ️  CORS headers already present in next.config.js"
fi

# Rebuild and restart the application
echo "🔨 Rebuilding application with CORS fix..."
npm run build

echo "🔄 Restarting service..."
systemctl restart hope-ims

echo "✅ CORS fix applied!"
ENDSSH

echo "🎉 CORS fix deployment complete!"
echo "🌐 Try accessing: http://195.35.1.75"