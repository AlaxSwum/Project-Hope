import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Set tracesSampleRate to 1.0 to capture 100%
  // of the transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Capture 100% of the sessions for user session data
  sessionSampleRate: 1.0,
  
  // Enable capture of console errors
  integrations: [
    new Sentry.BrowserTracing({
      // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
      tracePropagationTargets: [
        'localhost',
        /^https:\/\/yourapp\.com\/api/,
      ],
    }),
    new Sentry.Replay({
      // Capture 10% of all sessions for replay
      sessionSampleRate: 0.1,
      // Capture 100% of sessions with an error for replay
      errorSampleRate: 1.0,
    }),
  ],
  
  // Performance Monitoring
  beforeSend(event) {
    // Filter out development errors
    if (process.env.NODE_ENV === 'development') {
      return null;
    }
    return event;
  },
  
  // Additional configurations
  environment: process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
}); 