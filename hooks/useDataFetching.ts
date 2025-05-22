import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Attendee, HealthSystem, Conference } from '@/types'
import { useAuth } from '@/hooks/useAuth'

interface FetchOptions {
  page?: number
  pageSize?: number
  searchTerm?: string
  filters?: Array<{
    property: string
    operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'is_empty' | 'is_not_empty' | 'greater_than' | 'less_than'
    value: string
  }>
  entityType?: 'attendees' | 'health-systems' | 'conferences'
}

interface UseDataFetchingResult {
  attendees: Attendee[]
  healthSystems: HealthSystem[]
  conferences: Conference[]
  isLoading: boolean
  error: string | null
  totalCount: {
    attendees: number
    healthSystems: number
    conferences: number
  }
  fetchData: (options?: FetchOptions) => Promise<void>
  setAttendees: React.Dispatch<React.SetStateAction<Attendee[]>>
  setHealthSystems: React.Dispatch<React.SetStateAction<HealthSystem[]>>
  setConferences: React.Dispatch<React.SetStateAction<Conference[]>>
  hasMore: boolean
  currentPage: number
}

export function useDataFetching(): UseDataFetchingResult {
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [healthSystems, setHealthSystems] = useState<HealthSystem[]>([])
  const [conferences, setConferences] = useState<Conference[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [totalCount, setTotalCount] = useState({
    attendees: 0,
    healthSystems: 0,
    conferences: 0
  })
  const { session } = useAuth()
  
  // Use a ref to track active fetch requests and prevent race conditions
  const activeRequestRef = useRef<number>(0)
  
  // Flag to track if this is the initial load
  const initialLoadRef = useRef<boolean>(true)

  // Apply filters to a query builder
  const applyFilters = useCallback((query: any, filters: FetchOptions['filters'] = [], searchTerm: string = '', tableName: string) => {
    
    // Check for null or undefined filters
    if (!filters) {
      return query;
    }
    
    // Ensure filters is an array
    const filtersArray = Array.isArray(filters) ? filters : [];
    
    // Apply search term if provided
    if (searchTerm && searchTerm.trim() !== '') {
      // Customize this based on which fields should be searched for each table
      if (tableName === 'attendees') {
        query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,title.ilike.%${searchTerm}%,company.ilike.%${searchTerm}%`)
      } else if (tableName === 'health_systems') {
        query = query.or(`name.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%,state.ilike.%${searchTerm}%`)
      } else if (tableName === 'conferences') {
        query = query.or(`name.ilike.%${searchTerm}%,location.ilike.%${searchTerm}%`)
      }
    }

    // Check for empty filters array after ensuring it's an array
    if (filtersArray.length === 0) {
      return query;
    }

    // Apply each filter
    filtersArray.forEach((filter, _) => {
      if (!filter) {
        return;
      }
      
      const { property, operator, value } = filter

      if (!property || !operator) {
        return;
      }
      
      switch (operator) {
        case 'equals':
          // Check if this is a comma-separated list of values (like for filtering by a list of IDs)
          if (value && value.includes(',')) {
            const values = value.split(',').map(v => v.trim()).filter(Boolean);
            if (values.length > 0) {
              query = query.in(property, values);
            }
          } else if (value) {
            query = query.eq(property, value);
          }
          break;
        case 'contains':
          if (value) {
            query = query.ilike(property, `%${value}%`)
          }
          break
        case 'starts_with':
          if (value) {
            query = query.ilike(property, `${value}%`)
          }
          break
        case 'ends_with':
          if (value) {
            query = query.ilike(property, `%${value}`)
          }
          break
        case 'is_empty':
          query = query.or(`${property}.is.null,${property}.eq.''`)
          break
        case 'is_not_empty':
          query = query.not(`${property}`, 'is', null).not(`${property}`, 'eq', '')
          break
        case 'greater_than':
          if (value) {
            query = query.gt(property, value)
          }
          break
        case 'less_than':
          if (value) {
            query = query.lt(property, value)
          }
          break
      }
    })

    return query
  }, []);

  // Memoize fetchData to prevent it from causing render loops
  const fetchData = useCallback(async (options: FetchOptions = {}) => {
    // Create a unique request ID for this fetch operation
    const thisRequestId = activeRequestRef.current + 1
    activeRequestRef.current = thisRequestId
    
    // Only show loading indicator for initial load or when explicitly changing pages
    const isInitialLoad = initialLoadRef.current
    const isPageChange = options.page !== undefined && options.page !== currentPage
    
    if (isInitialLoad || isPageChange) {
      setIsLoading(true)
    }
    
    try {
      setError(null)

      // If not authenticated, early return with empty data
      if (!session) {
        setAttendees([])
        setConferences([])
        setHealthSystems([])
        setError("Authentication required to access data")
        initialLoadRef.current = false
        return
      }

      const { 
        page = 0, 
        pageSize = 50, 
        searchTerm = '', 
        filters = [],
        entityType
      } = options
      
      // Ensure filters is a valid array 
      const safeFilters = Array.isArray(filters) ? filters : [];

      // Calculate range for pagination
      const from = page * pageSize
      const to = from + pageSize - 1
      
      // Track all fetch promises to wait for all to complete
      const fetchPromises: Promise<any>[] = []

      // Only fetch data for the requested entity type if specified
      // Otherwise fetch all entity types (but in smaller batches)
      if (!entityType || entityType === 'attendees') {
        const attendeesPromise = (async () => {
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
  
          // Get the count first
          let countQuery = supabase
            .from('attendees')
            .select('*', { count: 'exact', head: true })
          
          // Apply filters to count query
          countQuery = applyFilters(countQuery, safeFilters, searchTerm, 'attendees')
          
          const { count: attendeesCount, error: countError } = await countQuery
  
          if (countError) throw countError
  
          // Now get the actual data with pagination
          let dataQuery = supabase
            .from('attendees')
            .select(attendeesQuery)
          
          // Apply filters to data query
          dataQuery = applyFilters(dataQuery, safeFilters, searchTerm, 'attendees')
            
          // Apply pagination
          const { data: attendeesData, error: dataError } = await dataQuery
            .range(from, to)
            .order('last_name', { ascending: true })
  
          if (dataError) throw dataError
          
          // Check if this request is still relevant (not superseded by a newer request)
          if (activeRequestRef.current !== thisRequestId) return
  
          // Determine if there are more records
          const hasMoreAttendees = (attendeesCount || 0) > (from + (attendeesData?.length || 0))
  
          // If it's the first page, replace the data; otherwise append
          if (page === 0 || entityType) {
            setAttendees(attendeesData || [])
          } else {
            setAttendees(prev => [...prev, ...(attendeesData || [])])
          }
  
          // Update total count
          setTotalCount(prev => ({ ...prev, attendees: attendeesCount || 0 }))
          
          // Update pagination state if we're only fetching attendees
          if (entityType === 'attendees') {
            setCurrentPage(page)
            setHasMore(hasMoreAttendees)
          }
        })()
        
        fetchPromises.push(attendeesPromise)
      }

      if (!entityType || entityType === 'health-systems') {
        const healthSystemsPromise = (async () => {
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
  
          // Get count
          let countQuery = supabase
            .from('health_systems')
            .select('*', { count: 'exact', head: true })
            
          // Apply filters to count query
          countQuery = applyFilters(countQuery, safeFilters, searchTerm, 'health_systems')
          
          const { count: healthSystemsCount, error: countError } = await countQuery
  
          if (countError) throw countError
  
          // Get data with pagination
          let dataQuery = supabase
            .from('health_systems')
            .select(healthSystemsQuery)
            
          // Apply filters to data query  
          dataQuery = applyFilters(dataQuery, safeFilters, searchTerm, 'health_systems')
            
          // Apply pagination
          const { data: healthSystemsData, error: dataError } = await dataQuery
            .range(from, to)
            .order('name', { ascending: true })
  
          if (dataError) throw dataError
          
          // Check if this request is still relevant (not superseded by a newer request)
          if (activeRequestRef.current !== thisRequestId) return
  
          // Determine if there are more records
          const hasMoreHealthSystems = (healthSystemsCount || 0) > (from + (healthSystemsData?.length || 0))
  
          // If it's the first page, replace the data; otherwise append
          if (page === 0 || entityType) {
            setHealthSystems(healthSystemsData || [])
          } else {
            setHealthSystems(prev => [...prev, ...(healthSystemsData || [])])
          }
  
          // Update total count
          setTotalCount(prev => ({ ...prev, healthSystems: healthSystemsCount || 0 }))
          
          // Update pagination state if we're only fetching health systems
          if (entityType === 'health-systems') {
            setCurrentPage(page)
            setHasMore(hasMoreHealthSystems)
          }
        })()
        
        fetchPromises.push(healthSystemsPromise)
      }

      if (!entityType || entityType === 'conferences') {
        const conferencesPromise = (async () => {
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
                company,
                email
              )
            )
          `
  
          // Get count
          let countQuery = supabase
            .from('conferences')
            .select('*', { count: 'exact', head: true })
            
          // Apply filters to count query
          countQuery = applyFilters(countQuery, safeFilters, searchTerm, 'conferences')
          
          const { count: conferencesCount, error: countError } = await countQuery
  
          if (countError) throw countError
  
          // Get data with pagination
          let dataQuery = supabase
            .from('conferences')
            .select(conferencesQuery)
            
          // Apply filters to data query
          dataQuery = applyFilters(dataQuery, safeFilters, searchTerm, 'conferences')
            
          // Apply pagination
          const { data: conferencesData, error: dataError } = await dataQuery
            .range(from, to)
            .order('start_date', { ascending: false })
  
          if (dataError) throw dataError
          
          // Check if this request is still relevant (not superseded by a newer request)
          if (activeRequestRef.current !== thisRequestId) return
          
          // Process the data to ensure consistent structure
          if (conferencesData) {
            conferencesData.forEach(conf => {
              if (conf.attendee_conferences) {
                // Make sure all attendee_conferences have properly structured attendees data
                conf.attendee_conferences = conf.attendee_conferences.map((ac: any) => {
                  // Add attendee reference for backward compatibility
                  return {
                    ...ac,
                    attendee: ac.attendees
                  };
                });
              }
            });
          }

          // Determine if there are more records
          const hasMoreConferences = (conferencesCount || 0) > (from + (conferencesData?.length || 0))
  
          // If it's the first page, replace the data; otherwise append
          if (page === 0 || entityType) {
            setConferences(conferencesData || [])
          } else {
            setConferences(prev => [...prev, ...(conferencesData || [])])
          }
  
          // Update total count
          setTotalCount(prev => ({ ...prev, conferences: conferencesCount || 0 }))
          
          // Update pagination state if we're only fetching conferences
          if (entityType === 'conferences') {
            setCurrentPage(page)
            setHasMore(hasMoreConferences)
          }
        })()
        
        fetchPromises.push(conferencesPromise)
      }
      
      // Wait for all fetch operations to complete
      await Promise.all(fetchPromises)

    } catch (err) {
      // Only update error state if this is still the current request
      if (activeRequestRef.current === thisRequestId) {
        setError(err instanceof Error ? err.message : 'An error occurred while fetching data')
        console.error('Error fetching data:', err)
      }
    } finally {
      // Only update loading state if this is still the current request
      if (activeRequestRef.current === thisRequestId) {
        setIsLoading(false)
        initialLoadRef.current = false
      }
    }
  }, [session, currentPage, applyFilters, setAttendees, setHealthSystems, setConferences, setCurrentPage, setHasMore, setTotalCount, setIsLoading, setError]) // Include all necessary dependencies

  // Initial data fetch on mount and auth state change
  useEffect(() => {
    fetchData()
  }, [fetchData]) // Include fetchData in the dependency array since it's now memoized

  return {
    attendees,
    healthSystems,
    conferences,
    isLoading,
    error,
    totalCount,
    fetchData,
    setAttendees,
    setHealthSystems,
    setConferences,
    hasMore,
    currentPage
  }
} 