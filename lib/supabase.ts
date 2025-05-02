import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Create the standard client with anon key (public)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Create a client with the service role key for bypassing RLS when needed
// Only use this for server-side operations where admin privileges are required
export const supabaseAdmin = serviceRoleKey 
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    })
  : supabase // Fallback to regular client if service role key is not available 