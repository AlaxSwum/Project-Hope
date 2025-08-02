/** @type {import('next').NextConfig} */
let withSentryConfig;
try {
  withSentryConfig = require('@sentry/nextjs').withSentryConfig;
} catch (e) {
  // Sentry not available, use identity function
  withSentryConfig = (config) => config;
}

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // Skip TypeScript checking during build
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Output configuration for Docker  
  // output: 'standalone', // Disabled - causes prerender issues with dynamic pages
  
  // Performance optimizations  
  experimental: {
    // optimizeCss: true, // Disabled - causes critters module error
    // optimizeImages: true, // Disabled - causes build issues
  },
  
  // Bundle analyzer
  ...(process.env.ANALYZE === 'true' ? { webpack: (config) => {
    const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
    config.plugins.push(new BundleAnalyzerPlugin());
    return config;
  }} : {}),
  
  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  },
  
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(), microphone=(), camera=()',
          },
        ],
      },
    ];
  },
  
  // Rewrites for API proxy (optional - for development)
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
  
  // Image optimization
  images: {
    domains: ['localhost'],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
  },
  
  // Compression
  compress: true,
  
  // Power by header removal
  poweredByHeader: false,
};

// Sentry configuration
const sentryWebpackPluginOptions = {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
};

module.exports = process.env.NODE_ENV === 'production' 
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig; 