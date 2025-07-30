import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

// Admin API endpoint for user management
// This should only be accessible to authenticated admin users

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required Supabase environment variables')
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // TODO: Add proper authentication middleware
  // This should verify the user is an admin before proceeding
  
  const { method } = req
  
  switch (method) {
    case 'POST':
      return createUser(req, res)
    case 'GET':
      return getUsers(req, res)
    case 'PUT':
      return updateUser(req, res)
    case 'DELETE':
      return deleteUser(req, res)
    default:
      res.setHeader('Allow', ['POST', 'GET', 'PUT', 'DELETE'])
      res.status(405).end(`Method ${method} Not Allowed`)
  }
}

async function createUser(req: NextApiRequest, res: NextApiResponse) {
  try {
    const userData = req.body
    
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true,
      user_metadata: {
        first_name: userData.firstName,
        last_name: userData.lastName,
        phone: userData.phone,
        username: userData.username,
        role: userData.role || 'staff'
      }
    })
    
    if (error) {
      return res.status(400).json({ error: error.message })
    }
    
    res.status(201).json({ data })
  } catch (error) {
    console.error('User creation error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

async function getUsers(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      return res.status(400).json({ error: error.message })
    }
    
    res.status(200).json({ data })
  } catch (error) {
    console.error('Get users error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

async function updateUser(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { userId, ...updateData } = req.body
    
    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select()
    
    if (error) {
      return res.status(400).json({ error: error.message })
    }
    
    res.status(200).json({ data })
  } catch (error) {
    console.error('Update user error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

async function deleteUser(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { userId } = req.body
    
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
    
    if (error) {
      return res.status(400).json({ error: error.message })
    }
    
    res.status(200).json({ success: true })
  } catch (error) {
    console.error('Delete user error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}