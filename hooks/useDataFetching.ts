import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Attendee, HealthSystem, Conference } from '@/types'
import { useAuth } from '@/hooks/useAuth'

// Helper function to fetch all records using pagination
async function fetchAllRecords<T>(
  table: string, 
  query: string, 
  pageSize = 1000,
): Promise<T[]> {
  let allData: T[] = []
  let page = 0
  let hasMore = true
  const client = supabase

  while (hasMore) {
    const from = page * pageSize
    const to = from + pageSize - 1
    
    const { data, error } = await client
      .from(table)
      .select(query, { count: 'exact' })
      .range(from, to)

    if (error) throw error
    
    if (data && data.length > 0) {
      allData = [...allData, ...data as T[]]
      page++
    }
    
    // If we got fewer records than requested, we've reached the end
    hasMore = data && data.length === pageSize
  }

  return allData
}

interface UseDataFetchingResult {
  attendees: Attendee[]
  healthSystems: HealthSystem[]
  conferences: Conference[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  setAttendees: React.Dispatch<React.SetStateAction<Attendee[]>>
  setHealthSystems: React.Dispatch<React.SetStateAction<HealthSystem[]>>
  setConferences: React.Dispatch<React.SetStateAction<Conference[]>>
}

export function useDataFetching(): UseDataFetchingResult {
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [healthSystems, setHealthSystems] = useState<HealthSystem[]>([])
  const [conferences, setConferences] = useState<Conference[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { session } = useAuth() // Get authentication status

  const fetchData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // If not authenticated, early return with empty data
      if (!session) {
        setAttendees([])
        setConferences([])
        setHealthSystems([])
        setError("Authentication required to access data")
        return
      }

      // Fetch all attendees with health system and conference info
      const attendeesQuery = `
        *,
        health_systems (id, name, definitive_id, website, address, city, state, zip),
        attendee_conferences (
          conference_id,
          conferences (
            id,
            name,
            start_date,
            end_date,
            location
          )
        )
      `
      const attendeesData = await fetchAllRecords<Attendee>('attendees', attendeesQuery, 1000)
      
      // Fetch all conferences with attendee info
      const conferencesQuery = `
        *,
        attendee_conferences (
          id,
          attendee_id,
          attendees:attendees (
            id,
            first_name,
            last_name,
            title,
            company
          )
        )
      `
      const conferencesData = await fetchAllRecords<Conference>('conferences', conferencesQuery, 1000)
      
      // Fetch all health systems with related attendees
      const healthSystemsQuery = `
        *,
        attendees (
          id,
          first_name,
          last_name,
          title,
          company,
          email,
          phone
        )
      `
      const healthSystemsData = await fetchAllRecords<HealthSystem>('health_systems', healthSystemsQuery, 1000)

      // Update state with fetched data
      setAttendees(attendeesData)
      setConferences(conferencesData)
      setHealthSystems(healthSystemsData)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while fetching data')
      console.error('Error fetching data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [session]) // Re-fetch when authentication state changes

  return {
    attendees,
    healthSystems,
    conferences,
    isLoading,
    error,
    refetch: fetchData,
    setAttendees,
    setHealthSystems,
    setConferences
  }
} 