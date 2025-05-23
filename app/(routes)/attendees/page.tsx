'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { TabNavigation } from '@/components/layout/TabNavigation'
import { useDataFetching } from '@/hooks/useDataFetching'
import { SelectionProvider, useSelection } from '@/lib/context/SelectionContext'
import { UserIcon } from '@heroicons/react/24/outline'
import { Icon } from '@/components/ui/Icon'
import { SearchBar } from '@/components/features/common/SearchBar'
import { FilterMenu } from '@/components/features/common/FilterMenu'
import { ViewToggle } from '@/components/ui/ViewToggle'
import { ViewSettingsMenu } from '@/components/ui/ViewSettingsMenu'
import { PropertiesMenu } from '@/components/ui/menus/PropertiesMenu'
import { DataTable } from '@/components/features/common/DataTable'
import { ItemCard } from '@/components/features/common/ItemCard'
import { useColumnManagement } from '@/hooks/useColumnManagement'
import { AddEntityButton } from '@/components/features/entities/AddEntityButton'
import { ActionBar } from '@/components/layout/ActionBar'
import { LoadMoreButton } from '@/components/ui/LoadMoreButton'
import type { Attendee, HealthSystem, Conference } from '@/types'
import { ColumnDef } from '@tanstack/react-table'
import { supabase } from '@/lib/supabase'
import { SelectAllButton } from '@/components/features/common/SelectAllButton'

// Define List interface to match the one used in TabNavigation
interface List {
  id: string
  name: string
  count: number
}

// Extend FetchOptions type to include listId
interface FetchOptionsExtended {
  page?: number
  pageSize?: number
  searchTerm?: string
  filters?: Array<{
    id: string
    property: string
    operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'is_empty' | 'is_not_empty' | 'greater_than' | 'less_than' | 'not_contains'
    value: string
  }>
  entityType?: 'attendees' | 'health-systems' | 'conferences'
  listId?: string | null
}

export default function AttendeesPage() {
  return (
    <SelectionProvider>
      <AttendeesPageContent />
    </SelectionProvider>
  )
}

function AttendeesPageContent() {
  const router = useRouter()
  const { selectedItems } = useSelection()
  const { attendees, healthSystems: _healthSystems, conferences: _conferences, isLoading, error, totalCount, fetchData, hasMore, currentPage, setCurrentPage: _setCurrentPage } = useDataFetching()
  
  // UI state
  const [view, setView] = useState<'table' | 'cards'>('cards')
  const [columnsPerRow, setColumnsPerRow] = useState(3)
  const [activeMenu, setActiveMenu] = useState<'filter' | 'properties' | 'view-settings' | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeFilters, setActiveFilters] = useState<Array<{
    id: string
    property: string
    operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'is_empty' | 'is_not_empty' | 'greater_than' | 'less_than' | 'not_contains'
    value: string
  }>>([])
  
  // List state
  const [lists, setLists] = useState<List[]>([])
  const [activeListId, setActiveListId] = useState<string | null>(null)
  const [isSelectingAll, setIsSelectingAll] = useState(false)
  
  // Use the column management hook
  const {
    visibleColumns,
    handleColumnToggle,
    getVisibleColumns,
    getFieldsForItem,
    allColumns,
    getFieldsForAllColumns
  } = useColumnManagement({
    activeTab: 'attendees'
  })
  
  // Filtered counts with proper types for TabNavigation
  const counts = {
    attendees: totalCount.attendees,
    'health-systems': totalCount.healthSystems,
    conferences: totalCount.conferences
  }
  
  // Fetch lists
  const fetchLists = useCallback(async (): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('lists')
        .select(`
          id,
          name,
          created_at,
          attendee_lists (
            attendee_id
          )
        `)
        .order('name');
      
      if (error) {
        throw error;
      }
      
      if (data) {
        const formattedLists = data.map(list => ({
          id: list.id,
          name: list.name,
          count: list.attendee_lists ? list.attendee_lists.length : 0
        }));
        
        setLists(formattedLists);
      }
    } catch (error) {
      console.error('Error fetching lists:', error);
    }
    
    return Promise.resolve();
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  // Add event listener for list selection from TabNavigation
  useEffect(() => {
    const handleListSelected = (event: CustomEvent) => {
      const { listId } = event.detail;
      if (listId) {
        setActiveListId(listId);
        fetchData({
          entityType: 'attendees',
          listId
        } as FetchOptionsExtended);
      }
    };

    window.addEventListener('listSelected', handleListSelected as EventListener);

    return () => {
      window.removeEventListener('listSelected', handleListSelected as EventListener);
    };
  }, [fetchData]);

  // Check for URL query parameter on load
  useEffect(() => {
    const url = new URL(window.location.href);
    const listId = url.searchParams.get('list');
    
    if (listId) {
      setActiveListId(listId);
      
      fetchData({
        entityType: 'attendees',
        listId: listId
      } as FetchOptionsExtended);
      
      window.history.replaceState({}, '', url.pathname);
    }
  }, [fetchData]);

  // Handle timing issue: automatically set isSelectingAll to false when items are actually selected
  useEffect(() => {
    if (isSelectingAll && selectedItems.length > 0) {
      setIsSelectingAll(false);
    }
  }, [isSelectingAll, selectedItems.length]);

  // List selection handler
  const handleListSelect = useCallback((listId: string | null) => {
    setActiveListId(listId);
    
    if (listId) {
      fetchData({
        entityType: 'attendees',
        listId: listId
      } as FetchOptionsExtended);
    } else {
      fetchData({
        entityType: 'attendees'
      });
    }
  }, [fetchData]);

  // Search handler
  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
    fetchData({
      page: 0,
      searchTerm: term,
      filters: activeFilters,
      entityType: 'attendees',
      listId: activeListId
    } as FetchOptionsExtended);
  }, [activeFilters, fetchData, activeListId]);

  // Filter handler
  const handleFilterChange = useCallback((filters: Array<{
    id: string
    property: string
    operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'is_empty' | 'is_not_empty' | 'greater_than' | 'less_than' | 'not_contains'
    value: string
  }>) => {
    setActiveFilters(filters);
    fetchData({
      page: 0,
      searchTerm,
      filters,
      entityType: 'attendees',
      listId: activeListId
    } as FetchOptionsExtended);
  }, [searchTerm, fetchData, activeListId]);

  // Handle menu toggle
  const handleMenuToggle = useCallback((menu: 'filter' | 'properties' | 'view-settings') => {
    setActiveMenu(prev => prev === menu ? null : menu);
  }, []);

  // Handle entity addition
  const handleEntityAdded = useCallback((_newEntity: Attendee | HealthSystem | Conference) => {
    fetchData({ 
      entityType: 'attendees',
      listId: activeListId
    } as FetchOptionsExtended)
  }, [fetchData, activeListId])

  // Tab change handler
  const handleTabChange = useCallback((tab: 'attendees' | 'health-systems' | 'conferences') => {
    router.push(`/${tab}`);
  }, [router]);

  // Click outside handler to close menus
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement
      if (!target.closest('.menu-button') && !target.closest('.menu-content')) {
        setActiveMenu(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Add handler for loading more attendees
  const handleLoadMore = useCallback(() => {
    if (isLoading) {
      console.log('Ignoring load more request - already loading');
      return;
    }
    
    const nextPage = currentPage + 1;
    
    console.log('Loading more attendees, current page:', currentPage, 'next page:', nextPage, 'timestamp:', new Date().toISOString());
    
    fetchData({
      page: nextPage,
      searchTerm,
      filters: activeFilters,
      entityType: 'attendees',
      listId: activeListId
    } as FetchOptionsExtended);
  }, [currentPage, searchTerm, activeFilters, fetchData, activeListId, isLoading]);

  return (
    <div className="flex h-screen">
      <TabNavigation
        activeTab="attendees"
        onTabChange={handleTabChange}
        counts={counts}
        activeListId={activeListId}
        onListSelect={handleListSelect}
        refreshLists={fetchLists}
        lists={lists}
      />
      
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 relative z-40">
            <div className="flex flex-col gap-2 w-full lg:max-w-xl">
              <SearchBar 
                placeholder="Search Attendees..."
                onSearch={handleSearch}
                activeTab="attendees"
                isLoading={isLoading}
              />
              
              <div className="text-sm text-gray-500 ml-1">
                <span>{counts.attendees} total attendees</span>
                {(searchTerm || activeFilters.length > 0 || activeListId) && (
                  <span> • {attendees.length} results showing</span>
                )}
                {activeListId && (
                  <span> • List: {lists.find(list => list.id === activeListId)?.name}</span>
                )}
              </div>
            </div>
            
            <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 whitespace-nowrap min-w-fit lg:w-auto lg:ml-auto relative z-40">
              <AddEntityButton 
                entityType="attendees"
                onEntityAdded={handleEntityAdded}
              />
              
              <FilterMenu
                onFilterChange={handleFilterChange}
                isOpen={activeMenu === 'filter'}
                onToggle={() => handleMenuToggle('filter')}
                allColumns={allColumns}
                isLoading={isLoading}
                activeFilters={activeFilters}
              />
              
              <PropertiesMenu
                visibleColumns={visibleColumns['attendees']}
                onColumnToggle={handleColumnToggle}
                view={view}
                isOpen={activeMenu === 'properties'}
                onToggle={() => handleMenuToggle('properties')}
                allColumns={allColumns}
                isLoading={isLoading}
              />
              
              <div className="flex items-center gap-4 relative z-40">
                <ViewToggle
                  view={view}
                  onViewChange={setView}
                />

                {view === 'cards' && (
                  <ViewSettingsMenu
                    columnsPerRow={columnsPerRow}
                    onColumnsPerRowChange={setColumnsPerRow}
                    isOpen={activeMenu === 'view-settings'}
                    onToggle={() => handleMenuToggle('view-settings')}
                  />
                )}
              
                <SelectAllButton
                  entityType="attendees"
                  currentItems={attendees}
                  currentFilters={activeFilters}
                  searchTerm={searchTerm}
                  listId={activeListId}
                  onSelectStateChange={setIsSelectingAll}
                />
              </div>
            </div>
          </div>
          
          <div className="mt-6">
            {isLoading && attendees.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent"></div>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                <p className="font-medium">Error loading data</p>
                <p className="text-sm">{error}</p>
              </div>
            ) : attendees.length === 0 && !isLoading && !searchTerm && activeFilters.length === 0 && !activeListId ? (
              <div className="flex flex-col items-center justify-center h-64">
                <p className="text-gray-500 mb-4">No attendees available. Would you like to add one?</p>
                <AddEntityButton 
                  entityType="attendees"
                  onEntityAdded={handleEntityAdded}
                />
              </div>
            ) : view === 'table' ? (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-100">
                <DataTable<Attendee>
                  data={attendees}
                  columns={getVisibleColumns() as ColumnDef<Attendee>[]}
                  onRowClick={(attendee) => router.push(`/attendees/${attendee.id}`)}
                />
              </div>
            ) : (
              <div className={`grid gap-4 relative z-0 ${
                columnsPerRow === 1 ? 'grid-cols-1' :
                columnsPerRow === 2 ? 'grid-cols-1 sm:grid-cols-2' :
                columnsPerRow === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' :
                'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
              }`}>
                {attendees.map((attendee, index) => (
                  <ItemCard
                    key={`${attendee.id}-${index}`}
                    title={`${attendee.first_name} ${attendee.last_name}`}
                    subtitle={attendee.title}
                    icon={<Icon icon={UserIcon} size="sm" className="text-gray-400" />}
                    onClick={() => router.push(`/attendees/${attendee.id}`)}
                    item={attendee}
                    fields={getFieldsForItem(attendee)}
                  />
                ))}
              </div>
            )}
            
            {attendees.length > 0 && (
              <LoadMoreButton 
                onClick={handleLoadMore}
                isLoading={isLoading}
                hasMore={hasMore}
                currentPage={currentPage}
              />
            )}
          </div>
        </div>
      </div>
      
      <ActionBar 
        onEnrichmentComplete={() => fetchData({ 
          entityType: 'attendees', 
          listId: activeListId 
        } as FetchOptionsExtended)}
        onDefinitiveEnrichmentComplete={() => fetchData({ 
          entityType: 'attendees', 
          listId: activeListId 
        } as FetchOptionsExtended)}
        onAIEnrichmentComplete={() => fetchData({ 
          entityType: 'attendees', 
          listId: activeListId 
        } as FetchOptionsExtended)}
        onDelete={() => fetchData({ 
          entityType: 'attendees', 
          listId: activeListId 
        } as FetchOptionsExtended)}
        conferenceName=""
        activeListId={activeListId}
        onListDelete={() => {
          setActiveListId(null);
          fetchLists();
          fetchData({ entityType: 'attendees' });
        }}
        refreshLists={fetchLists}
        allColumns={allColumns}
        getFieldsForAllColumns={getFieldsForAllColumns}
        isSelectingAll={isSelectingAll}
      />
    </div>
  )
} 