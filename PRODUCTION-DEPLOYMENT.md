# Hope IMS - Production Deployment Guide

## Overview
This guide covers deploying the Hope IMS (Inventory Management System) to production with security, performance, and reliability best practices.

## Critical Security Changes Made

### 🔒 Service Role Key Security Fix
**CRITICAL**: The Supabase service role key has been moved from the frontend to secure API routes:
- ❌ **Before**: `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` (exposed to client)
- ✅ **After**: `SUPABASE_SERVICE_ROLE_KEY` (server-side only)

**Action Required**: Update your environment variables and never expose service role keys to the frontend.

## Production Readiness Checklist

### ✅ Security
- [x] Service role key moved to secure API routes
- [x] Security headers configured in Next.js
- [x] Environment variables properly secured
- [x] Sentry error tracking implemented
- [x] CORS configuration added

### ✅ Performance
- [x] Next.js build optimizations enabled
- [x] Image optimization configured
- [x] Bundle analysis tools added
- [x] Compression enabled
- [x] Standalone output for Docker

### ✅ Testing
- [x] Jest unit testing setup
- [x] React Testing Library integration
- [x] Playwright E2E testing
- [x] Coverage reporting
- [x] CI/CD pipeline with tests

### ✅ Monitoring & Observability
- [x] Health check endpoint (`/api/health`)
- [x] Sentry error tracking
- [x] Performance monitoring
- [x] Docker health checks

### ✅ DevOps
- [x] Multi-stage Docker configuration
- [x] Docker Compose for development and production
- [x] GitHub Actions CI/CD pipeline
- [x] Security scanning with Snyk
- [x] Automated testing and deployment

## Environment Variables

### Required Production Variables
```bash
# Database
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Server-side only!

# Authentication
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=your-32-character-secret-key

# Application
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NODE_ENV=production

# Monitoring
NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn.ingest.sentry.io/project-id
SENTRY_DSN=https://your-sentry-dsn.ingest.sentry.io/project-id
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
```

## Deployment Options

### 1. Docker Deployment (Recommended)

#### Build and Run
```bash
# Build production image
cd frontend
docker build -t hope-ims:latest .

# Run with environment variables
docker run -d \
  --name hope-ims \
  -p 3000:3000 \
  --env-file .env.production \
  hope-ims:latest
```

#### Using Docker Compose
```bash
# Production deployment
docker-compose up -d

# Development with hot reload
docker-compose --profile dev up -d
```

### 2. Vercel Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd frontend
vercel --prod
```

### 3. Traditional Hosting

```bash
# Build the application
cd frontend
npm ci --only=production
npm run build

# Start production server
npm start
```

## CI/CD Pipeline

The GitHub Actions workflow includes:

1. **Code Quality**: Linting and type checking
2. **Testing**: Unit tests with coverage reporting
3. **Security**: Dependency scanning with Snyk
4. **E2E Testing**: Playwright browser tests
5. **Build**: Production build verification
6. **Docker**: Multi-platform image building
7. **Deploy**: Automated deployment to staging/production

### Required GitHub Secrets
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SENTRY_DSN
SNYK_TOKEN
REGISTRY_URL
REGISTRY_USERNAME
REGISTRY_PASSWORD
```

## Performance Optimization

### Implemented Optimizations
- Bundle splitting and tree shaking
- Image optimization with WebP/AVIF
- Gzip compression
- Static generation where possible
- Cache-first loading strategies

### Monitoring
- Health check endpoint at `/api/health`
- Performance metrics via Sentry
- Memory and CPU monitoring in Docker

## Security Considerations

### Headers
Security headers are automatically applied:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

### Database Security
- Row Level Security (RLS) enabled in Supabase
- Service role key never exposed to client
- API routes handle privileged operations

### Error Handling
- Sentry captures and reports errors
- Sensitive information filtered from error reports
- Graceful error boundaries in React components

## Scaling Considerations

### Horizontal Scaling
- Stateless application design
- Health checks for load balancer integration
- Graceful shutdown handling

### Database
- Connection pooling via Supabase
- Query optimization and indexing
- Backup and recovery procedures

## Maintenance

### Regular Tasks
1. **Security Updates**: Monthly dependency updates
2. **Monitoring**: Weekly review of error reports
3. **Performance**: Monthly performance audits
4. **Backups**: Daily database backups (via Supabase)

### Health Monitoring
```bash
# Check application health
curl https://yourdomain.com/api/health

# Expected response
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123456,
  "environment": "production",
  "checks": {
    "database": "ok",
    "memory": { "used": 45, "total": 128 },
    "nodeVersion": "v18.18.0"
  }
}
```

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check environment variables are set
   - Verify Node.js version compatibility
   - Review build logs for missing dependencies

2. **Database Connection Issues**
   - Verify Supabase URL and keys
   - Check network connectivity
   - Review RLS policies

3. **Performance Issues**
   - Monitor memory usage via health endpoint
   - Check Sentry performance metrics
   - Review database query performance

### Support
- Error tracking: [Sentry Dashboard]
- Performance monitoring: Built-in metrics
- Logs: Docker logs or platform-specific logging

## Post-Deployment Verification

1. ✅ Application loads correctly
2. ✅ Authentication works
3. ✅ Health endpoint responds
4. ✅ Error tracking operational
5. ✅ Performance monitoring active
6. ✅ Database connectivity confirmed

---

**Next Steps**: After deployment, monitor the application closely for the first 24-48 hours and set up alerts for critical metrics. 