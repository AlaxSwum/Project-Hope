import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
  }

  const healthStatus = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    checks: {
      database: 'unknown',
      memory: 'unknown',
      nodeVersion: process.version
    }
  }

  try {
    // Check database connectivity
    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey)
      const { error } = await supabase.from('users').select('count').limit(1)
      healthStatus.checks.database = error ? 'error' : 'ok'
    }

    // Check memory usage
    const memUsage = process.memoryUsage()
    healthStatus.checks.memory = {
      used: Math.round(memUsage.heapUsed / 1024 / 1024),
      total: Math.round(memUsage.heapTotal / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024)
    }

    res.status(200).json(healthStatus)
  } catch (error) {
    console.error('Health check error:', error)
    res.status(503).json({
      ...healthStatus,
      status: 'error',
      error: 'Health check failed'
    })
  }
} 