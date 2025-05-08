import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Session, User } from '@supabase/supabase-js'

interface AuthState {
  session: Session | null
  user: User | null
  isLoading: boolean
  error: string | null
}

interface UseAuthReturn extends AuthState {
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    isLoading: true,
    error: null
  })

  async function signIn(email: string, password: string) {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))
      
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error
      
      // Authentication successful, session will be updated by the useEffect
    } catch (err) {
      setState(prev => ({ 
        ...prev, 
        error: err instanceof Error ? err.message : 'Failed to sign in',
        isLoading: false
      }))
    }
  }

  async function signOut() {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      // Clear auth state on sign out
      setState({
        session: null,
        user: null,
        isLoading: false,
        error: null
      })
    } catch (err) {
      setState(prev => ({ 
        ...prev, 
        error: err instanceof Error ? err.message : 'Failed to sign out',
        isLoading: false
      }))
    }
  }

  useEffect(() => {
    // Get current session on mount
    async function getInitialSession() {
      try {
        setState(prev => ({ ...prev, isLoading: true }))
        
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) throw error
        
        const user = session?.user ?? null
        
        setState({
          session,
          user,
          isLoading: false,
          error: null
        })
      } catch (err) {
        setState({
          session: null,
          user: null,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to get session'
        })
      }
    }

    getInitialSession()

    // Set up listener for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_, session) => {
        const user = session?.user ?? null
        
        setState({
          session,
          user,
          isLoading: false,
          error: null
        })
      }
    )

    // Clean up subscription
    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return {
    ...state,
    signIn,
    signOut
  }
} 