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
    operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'is_empty' | 'is_not_empty' | 'greater_than' | 'less_than' | 'not_contains'
    value: string
  }>
  entityType?: 'attendees' | 'health-systems' | 'conferences'
  listId?: string | null
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
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>
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
  
  // Flag to track if this is the initial load
  const initialLoadRef = useRef<boolean>(true)
  
  // Track the last entityType fetched to detect changes
  const lastEntityTypeRef = useRef<string | undefined>(undefined)

  // Add a ref to track the last fetch request timestamp to avoid too frequent refetches
  const lastFetchTimeRef = useRef<number>(0);

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
        case 'not_contains':
          if (value) {
            query = query.not(property, 'ilike', `%${value}%`)
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
    const now = Date.now();
    // Prevent rapid re-fetches (debounce mechanism)
    if (now - lastFetchTimeRef.current < 300) {
      console.log('Fetch request debounced, too soon after previous fetch');
      return;
    }
    lastFetchTimeRef.current = now;
    
    const {
      page = 0,
      pageSize = 50,
      searchTerm = '',
      filters = [],
      entityType,
      listId = null
    } = options;

    // Show loading indicator
    setIsLoading(true);

    try {
      // Ensure filters is valid
      const safeFilters = Array.isArray(filters) ? filters : [];

      // Initialize the pagination range
      const from = page * pageSize;
      const to = from + pageSize - 1;

      // Store current entity type for the hasMore calculations
      lastEntityTypeRef.current = entityType;

      // Keep track of all data fetched during this operation
      let fetchedAttendees: Attendee[] = [];
      let fetchedHealthSystems: HealthSystem[] = [];
      let fetchedConferences: Conference[] = [];
      
      // Fetch counts for all entity types to support hasMore calculations
      let newTotalCounts = { ...totalCount };

      // Process requests based on entity type
      if (!entityType || entityType === 'attendees') {
        const result = await fetchAttendees({
          from,
          to,
          searchTerm,
          filters: safeFilters,
          listId
        });
        
        fetchedAttendees = result.data;
        newTotalCounts.attendees = result.count;
      }

      if (!entityType || entityType === 'health-systems') {
        const result = await fetchHealthSystems({
          from,
          to,
          searchTerm,
          filters: safeFilters,
        });
        
        fetchedHealthSystems = result.data;
        newTotalCounts.healthSystems = result.count;
      }

      if (!entityType || entityType === 'conferences') {
        const result = await fetchConferences({
          from,
          to,
          searchTerm,
          filters: safeFilters,
        });
        
        fetchedConferences = result.data;
        newTotalCounts.conferences = result.count;
      }

      // Update total counts first
      setTotalCount(newTotalCounts);
      
      // Update current page
      if (page !== currentPage) {
        setCurrentPage(page);
      }
      
      // Update entity data based on page
      if (entityType === 'attendees' || !entityType) {
        // Get current state before update
        const currentLength = attendees.length;
        
        if (page === 0) {
          // Replace mode
          setAttendees(fetchedAttendees);
        } else {
          // Append mode with deduplication
          setAttendees(prev => {
            const combined = [...prev, ...fetchedAttendees];
            const unique = getUniqueItemsById(combined);
            return unique;
          });
        }
        
        // Determine hasMore for attendees
        const hasMoreAttendees = (currentLength + fetchedAttendees.length) < newTotalCounts.attendees;
        
        if (entityType === 'attendees') {
          setHasMore(hasMoreAttendees);
        }
      }
      
      if (entityType === 'health-systems' || !entityType) {
        // Get current state before update
        const currentLength = healthSystems.length;
        
        if (page === 0) {
          // Replace mode
          setHealthSystems(fetchedHealthSystems);
        } else {
          // Append mode with deduplication
          setHealthSystems(prev => {
            const combined = [...prev, ...fetchedHealthSystems];
            const unique = getUniqueItemsById(combined);
            return unique;
          });
        }
        
        // Determine hasMore for health systems
        const hasMoreHealthSystems = (currentLength + fetchedHealthSystems.length) < newTotalCounts.healthSystems;
        
        if (entityType === 'health-systems') {
          setHasMore(hasMoreHealthSystems);
        }
      }
      
      if (entityType === 'conferences' || !entityType) {
        // Get current state before update
        const currentLength = conferences.length;
        
        if (page === 0) {
          // Replace mode
          setConferences(fetchedConferences);
        } else {
          // Append mode with deduplication
          setConferences(prev => {
            const combined = [...prev, ...fetchedConferences];
            const unique = getUniqueItemsById(combined);
            return unique;
          });
        }
        
        // Determine hasMore for conferences
        const hasMoreConferences = (currentLength + fetchedConferences.length) < newTotalCounts.conferences;
        
        if (entityType === 'conferences') {
          setHasMore(hasMoreConferences);
        }
      }
      
      // If no specific entity type, set global hasMore
      if (!entityType) {
        // Check if any entity type has more data
        const globalHasMore = 
          (attendees.length + fetchedAttendees.length) < newTotalCounts.attendees ||
          (healthSystems.length + fetchedHealthSystems.length) < newTotalCounts.healthSystems ||
          (conferences.length + fetchedConferences.length) < newTotalCounts.conferences;
        
        setHasMore(globalHasMore);
      }

      // Mark initial load as complete
      initialLoadRef.current = false;
      
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while fetching data');
    } finally {
      // Always ensure loading state is reset
      setIsLoading(false);
    }
  }, [applyFilters]); // Only depend on applyFilters - don't include state that changes due to this function

  // Helper function to ensure unique items by id
  const getUniqueItemsById = <T extends { id: string }>(items: T[]): T[] => {
    const seen = new Map<string, T>();
    items.forEach(item => {
      if (!seen.has(item.id)) {
        seen.set(item.id, item);
      }
    });
    return Array.from(seen.values());
  };

  // Helper function to fetch attendees - refactored to return data instead of updating state
  const fetchAttendees = async ({
    from,
    to,
    searchTerm,
    filters,
    listId
  }: {
    from: number;
    to: number;
    searchTerm: string;
    filters: any[];
    listId: string | null;
  }): Promise<{ data: Attendee[], count: number }> => {
    try {
      let query = `
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
      `;

      // Add attendee_lists join if filtering by list
      if (listId) {
        query = `
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
          ),
          attendee_lists!inner (
            id,
            list_id
          )
        `;
      }

      // Get count
      let countQuery = supabase
        .from('attendees')
        .select('*', { count: 'exact', head: true });
      
      // Add list filter if listId is provided
      if (listId) {
        // For count query with list filter, we need to use a different approach
        countQuery = supabase
          .from('attendee_lists')
          .select('attendee_id', { count: 'exact', head: true })
          .eq('list_id', listId);
      }
      
      // Apply filters to count query if not using listId
      // (we can't apply complex filters to the join count query)
      if (!listId) {
        countQuery = applyFilters(countQuery, filters, searchTerm, 'attendees');
      }
      
      const { count: attendeesCount, error: countError } = await countQuery;

      if (countError) throw countError;

      // Now get the actual data with pagination
      let dataQuery = supabase
        .from('attendees')
        .select(query);
      
      // Apply list filter if listId is provided
      if (listId) {
        dataQuery = dataQuery.eq('attendee_lists.list_id', listId);
      }
      
      // Apply filters to data query
      dataQuery = applyFilters(dataQuery, filters, searchTerm, 'attendees');
        
      // Apply pagination
      const { data: attendeesData, error: dataError } = await dataQuery
        .range(from, to)
        .order('last_name', { ascending: true });

      if (dataError) throw dataError;

      // Helper function to validate attendee data
      const isValidAttendeeArray = (data: any): data is Attendee[] => {
        return Array.isArray(data) && data.every(item => 
          item && typeof item === 'object' && 'id' in item
        );
      };

      // Return the validated data and count
      return {
        data: isValidAttendeeArray(attendeesData) ? attendeesData : [],
        count: attendeesCount || 0
      };
    } catch (error) {
      console.error('Error fetching attendees:', error);
      return { data: [], count: 0 };
    }
  };

  // Helper function to fetch health systems - refactored to return data instead of updating state
  const fetchHealthSystems = async ({
    from,
    to,
    searchTerm,
    filters
  }: {
    from: number;
    to: number;
    searchTerm: string;
    filters: any[];
  }): Promise<{ data: HealthSystem[], count: number }> => {
    try {
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
      `;

      // Get count
      let countQuery = supabase
        .from('health_systems')
        .select('*', { count: 'exact', head: true });
        
      // Apply filters to count query
      countQuery = applyFilters(countQuery, filters, searchTerm, 'health_systems');
      
      const { count: healthSystemsCount, error: countError } = await countQuery;

      if (countError) throw countError;

      // Get data with pagination
      let dataQuery = supabase
        .from('health_systems')
        .select(healthSystemsQuery);
        
      // Apply filters to data query  
      dataQuery = applyFilters(dataQuery, filters, searchTerm, 'health_systems');
        
      // Apply pagination
      const { data: healthSystemsData, error: dataError } = await dataQuery
        .range(from, to)
        .order('name', { ascending: true });

      if (dataError) throw dataError;

      // Helper function to validate health system data
      const isValidHealthSystemArray = (data: any): data is HealthSystem[] => {
        return Array.isArray(data) && data.every(item => 
          item && typeof item === 'object' && 'id' in item
        );
      };

      // Return the validated data and count
      return {
        data: isValidHealthSystemArray(healthSystemsData) ? healthSystemsData : [],
        count: healthSystemsCount || 0
      };
    } catch (error) {
      console.error('Error fetching health systems:', error);
      return { data: [], count: 0 };
    }
  };

  // Helper function to fetch conferences - refactored to return data instead of updating state
  const fetchConferences = async ({
    from,
    to,
    searchTerm,
    filters,
  }: {
    from: number;
    to: number;
    searchTerm: string;
    filters: any[];
  }): Promise<{ data: Conference[], count: number }> => {
    try {
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
      `;

      // Get count
      let countQuery = supabase
        .from('conferences')
        .select('*', { count: 'exact', head: true });
        
      // Apply filters to count query
      countQuery = applyFilters(countQuery, filters, searchTerm, 'conferences');
      
      const { count: conferencesCount, error: countError } = await countQuery;

      if (countError) throw countError;

      // Get data with pagination
      let dataQuery = supabase
        .from('conferences')
        .select(conferencesQuery);
        
      // Apply filters to data query
      dataQuery = applyFilters(dataQuery, filters, searchTerm, 'conferences');
        
      // Apply pagination
      const { data: conferencesData, error: dataError } = await dataQuery
        .range(from, to)
        .order('start_date', { ascending: false });

      if (dataError) throw dataError;
      
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

      // Helper function to validate conference data
      const isValidConferenceArray = (data: any): data is Conference[] => {
        return Array.isArray(data) && data.every(item => 
          item && typeof item === 'object' && 'id' in item
        );
      };

      // Return the validated data and count
      return {
        data: isValidConferenceArray(conferencesData) ? conferencesData : [],
        count: conferencesCount || 0
      };
    } catch (error) {
      console.error('Error fetching conferences:', error);
      return { data: [], count: 0 };
    }
  };

  // Initial data fetch on mount and auth state change
  useEffect(() => {
    if (session) {
      console.log('Initial data fetch triggered by session change');
      fetchData();
    }
  }, [fetchData, session]);

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
    setCurrentPage,
    hasMore,
    currentPage
  }
} 