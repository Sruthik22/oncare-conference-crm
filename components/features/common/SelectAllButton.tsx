import { useState, useCallback, useEffect } from 'react'
import { useSelection } from '@/lib/context/SelectionContext'
import { supabase } from '@/lib/supabase'

type EntityType = 'attendees' | 'health-systems' | 'conferences'

interface SelectAllButtonProps {
  entityType: EntityType
  currentItems: any[]
  currentFilters?: Array<{
    id?: string
    property: string
    operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'is_empty' | 'is_not_empty' | 'greater_than' | 'less_than' | 'not_contains'
    value: string
  }>
  searchTerm?: string
  listId?: string | null
  onSelectStateChange?: (isSelectingAll: boolean) => void
}

export function SelectAllButton({ 
  entityType, 
  currentItems, 
  currentFilters = [],
  searchTerm = '',
  listId = null,
  onSelectStateChange
}: SelectAllButtonProps) {
  const { selectAll, deselectAll } = useSelection()
  const [isSelecting, setIsSelecting] = useState(false)
  const [isAllSelected, setIsAllSelected] = useState(false)
  const [selectionCount, setSelectionCount] = useState(0)
  const [progressMessage, setProgressMessage] = useState('')
  
  // Track the last selection made for comparison
  const [lastSelectionSignature, setLastSelectionSignature] = useState('')
  
  // Check if selection is still valid based on current filters/search
  const checkSelectionValidity = useCallback(() => {
    // Create a signature from the current filter state
    const currentSignature = JSON.stringify({
      entityType,
      filterCount: currentFilters.length,
      searchTerm,
      listId
    })
    
    // If signature changed, reset the selection state
    if (isAllSelected && lastSelectionSignature && lastSelectionSignature !== currentSignature) {
      setIsAllSelected(false)
      setSelectionCount(0)
    }
  }, [entityType, currentFilters, searchTerm, listId, isAllSelected, lastSelectionSignature])
  
  // Call the check when dependencies change
  useEffect(() => {
    checkSelectionValidity()
  }, [checkSelectionValidity])

  // Get the database table name from entity type
  const getTableName = (type: EntityType): string => {
    switch (type) {
      case 'health-systems':
        return 'health_systems'
      default:
        return type
    }
  }

  // Apply filters to the query
  const applyFilters = (query: any, filters: any[] = [], searchTerm: string = '') => {
    // Apply search term if provided
    if (searchTerm && searchTerm.trim() !== '') {
      const tableName = getTableName(entityType)
      if (tableName === 'attendees') {
        query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,title.ilike.%${searchTerm}%,company.ilike.%${searchTerm}%`)
      } else if (tableName === 'health_systems') {
        query = query.or(`name.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%,state.ilike.%${searchTerm}%`)
      } else if (tableName === 'conferences') {
        query = query.or(`name.ilike.%${searchTerm}%,location.ilike.%${searchTerm}%`)
      }
    }

    // Apply each filter
    filters.forEach(filter => {
      if (!filter || !filter.property || !filter.operator) return
      
      const { property, operator, value } = filter

      switch (operator) {
        case 'equals':
          if (value && value.includes(',')) {
            const values = value.split(',').map((v: string) => v.trim()).filter(Boolean)
            if (values.length > 0) {
              query = query.in(property, values)
            }
          } else if (value) {
            query = query.eq(property, value)
          }
          break
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
  }

  const handleSelectAll = async () => {
    if (isAllSelected) {
      // If everything is already selected, just deselect all
      deselectAll()
      setIsAllSelected(false)
      setSelectionCount(0)
      setProgressMessage('')
      setLastSelectionSignature('')
      onSelectStateChange?.(false)
      return
    }

    // Show loading state
    setIsSelecting(true)
    setProgressMessage('Starting selection...')
    onSelectStateChange?.(true)
    
    const tableName = getTableName(entityType)
    
    try {
      // Create a signature for this selection operation
      const selectionSignature = JSON.stringify({
        entityType,
        filterCount: currentFilters.length,
        searchTerm,
        listId
      })
      
      // First, select the items we already have loaded in the UI for immediate feedback
      selectAll(currentItems)
      setSelectionCount(currentItems.length)
      setProgressMessage(`Selected ${currentItems.length} loaded items...`)
      
      // Initialize an array to hold all IDs
      let allIds: string[] = []
      let count = 0
      let page = 0
      const pageSize = 1000 // Supabase typically has a limit around this number
      let hasMorePages = true
      
      // Fetch all IDs with pagination to handle large datasets
      while (hasMorePages) {
        // Set status message while fetching
        setProgressMessage(`Fetching page ${page + 1}${count ? ` (${allIds.length} of ~${count})` : ''}...`)
        
        // Special handling for attendees in a list view
        if (listId && entityType === 'attendees') {
          try {
            // This is a separate query for list items, so we handle it differently
            const { data: listData, error: listError, count: listCount } = await supabase
              .from('attendee_lists')
              .select('attendee_id', { count: 'exact' })
              .eq('list_id', listId)
              .range(page * pageSize, (page + 1) * pageSize - 1);
            
            if (listError) {
              console.error(`Error fetching list attendee IDs (page ${page}):`, listError);
              throw listError;
            }
            
            // Process the results if we got data
            if (listData && listData.length > 0) {
              // Extract just the attendee_id from each record
              const pageIds = listData.map(item => item.attendee_id);
              allIds = [...allIds, ...pageIds];
              
              // For the first page, set the total count
              if (page === 0 && listCount !== null) {
                count = listCount;
              }
              
              // Check if we need to fetch more pages
              hasMorePages = listData.length === pageSize;
              page++;
              
              // Log progress for larger datasets
              if (page > 1) {
                console.log(`Fetching page ${page} of list IDs, ${allIds.length} fetched so far...`);
                setProgressMessage(`Loading ${allIds.length} of ~${count} items...`);
              }
            } else {
              // No more data
              hasMorePages = false;
            }
            
            // Skip the regular query execution for this iteration
            continue;
          } catch (listQueryError) {
            console.error('Error in list query:', listQueryError);
            // Fall back to regular filtering if the specialized query fails
          }
        }
        
        // Create a new query for each page request
        let query = supabase.from(tableName).select('id', { count: 'exact' })
        
        // Apply the same filters that are currently active
        query = applyFilters(query, currentFilters, searchTerm)
        
        // Add pagination
        query = query.range(page * pageSize, (page + 1) * pageSize - 1)
        
        try {
          // Execute the query to get matching IDs for this page
          const { data, error, count: totalCount } = await query
          
          if (error) {
            console.error(`Error fetching IDs for Select All (page ${page}):`, error)
            throw error
          }
          
          // If we got data, add the IDs to our collection
          if (data && data.length > 0) {
            const pageIds = data.map(item => item.id)
            allIds = [...allIds, ...pageIds]
            
            // For the first page, set the total count
            if (page === 0 && totalCount !== null) {
              count = totalCount
              setProgressMessage(`Loading ${allIds.length} of ~${count} items...`)
            }
            
            // Add a delay for very large datasets to prevent rate limiting
            if (page > 5 && count > 10000) {
              await new Promise(resolve => setTimeout(resolve, 500))
            }
            
            // Check if we need to fetch more pages
            hasMorePages = data.length === pageSize
            page++
            
            // Log progress for larger datasets
            if (page > 1) {
              console.log(`Fetching page ${page} of IDs, ${allIds.length} fetched so far...`)
              setProgressMessage(`Loading ${allIds.length} of ~${count} items...`)
            }
          } else {
            // No more data
            hasMorePages = false
          }
        } catch (pageError) {
          console.error(`Error fetching page ${page}:`, pageError)
          // We'll continue with the IDs we've collected so far
          hasMorePages = false
          setProgressMessage(`Error fetching page ${page}. Using partial results.`)
        }
        
        // Safety check to prevent infinite loops
        if (page > 100) {
          console.warn('Reached maximum page limit (100). Selection may be incomplete.')
          hasMorePages = false
          setProgressMessage('Reached maximum page limit. Using partial results.')
        }
      }
      
      console.log(`Total records fetched: ${allIds.length}`)
      setProgressMessage(`Finalizing selection of ${allIds.length} items...`)
      
      // Loop through existing items and update them with their full data
      const updatedItems = currentItems.map(item => {
        // Find the index of this item's ID in the allIds array
        const index = allIds.indexOf(item.id)
        // If found, remove it from allIds to avoid duplicates
        if (index > -1) {
          allIds.splice(index, 1)
        }
        // Return the full item
        return item
      })
      
      // For the remaining IDs, create minimal objects with required fields based on entity type
      // These are placeholder objects that will be replaced with real data when needed by ActionBar operations
      const additionalItems = allIds.map(id => {
        // Create a minimal object with just ID and essential fields to prevent UI crashes
        if (entityType === 'attendees') {
          // Minimal attendee object - real data will be loaded by ActionBar operations as needed
          return { 
            id, 
            first_name: '[LOADING]', 
            last_name: '[LOADING]',
            company: '',
            title: '',
            email: '',
            phone: ''
          }
        } else if (entityType === 'health-systems') {
          // Minimal health system object - real data will be loaded by ActionBar operations as needed
          return { 
            id, 
            name: '[LOADING]'
          }
        } else if (entityType === 'conferences') {
          // Minimal conference object - real data will be loaded by ActionBar operations as needed
          return { 
            id, 
            name: '[LOADING]',
            start_date: new Date().toISOString()
          }
        }
        // Default fallback
        return { id }
      })
      
      // Combine current items and minimal placeholder items
      const allItems = [...updatedItems, ...additionalItems]
      
      // Select all items (including placeholders)
      selectAll(allItems)
      setSelectionCount(allItems.length)
      setIsAllSelected(true)
      setLastSelectionSignature(selectionSignature)
      
      setProgressMessage('')
    } catch (err) {
      console.error('Error in Select All operation:', err)
      // In case of error, just select the items we have
      selectAll(currentItems)
      setSelectionCount(currentItems.length)
      setProgressMessage('Error loading all items')
    } finally {
      setIsSelecting(false)
      onSelectStateChange?.(false)
    }
  }

  return (
    <button
      className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      onClick={handleSelectAll}
      disabled={isSelecting}
    >
      {isSelecting ? (
        <>
          <span className="mr-2 animate-spin">⌛</span>
          <span>{progressMessage || 'Selecting...'}</span>
        </>
      ) : isAllSelected ? (
        <>Deselect All ({selectionCount.toLocaleString()})</>
      ) : (
        <>Select All</>
      )}
    </button>
  )
} 