'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useParams } from 'next/navigation'
import { TabNavigation } from '@/components/layout/TabNavigation'
import { useDataFetching } from '@/hooks/useDataFetching'
import { SelectionProvider } from '@/lib/context/SelectionContext'
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
import { ActionBar } from '@/components/layout/ActionBar'
import { LoadMoreButton } from '@/components/ui/LoadMoreButton'
import { SelectAllButton } from '@/components/features/common/SelectAllButton'
import type { Attendee } from '@/types'
import { ColumnDef } from '@tanstack/react-table'
import { supabase } from '@/lib/supabase'

// Define List interface
interface List {
  id: string
  name: string
  count: number
}

// Extend FetchOptions type
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

export default function ListDetailPage() {
  const router = useRouter()
  const params = useParams()
  const listId = params.listId as string
  const [currentList, setCurrentList] = useState<List | null>(null)
  
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
  const [isSelectingAll, setIsSelectingAll] = useState(false)
  
  // List state
  const [lists, setLists] = useState<List[]>([])
  
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
  
  // We no longer need filteredCounts since we want to always show total counts in the sidebar
  
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
        // Convert to the expected format with count
        const formattedLists = data.map(list => ({
          id: list.id,
          name: list.name,
          count: list.attendee_lists ? list.attendee_lists.length : 0
        }));
        
        setLists(formattedLists);
        
        // Find the current list
        const list = formattedLists.find(list => list.id === listId);
        setCurrentList(list || null);
      }
    } catch (error) {
      console.error('Error fetching lists:', error);
    }
    
    return Promise.resolve();
  }, [listId]);

  // Initial data fetch
  useEffect(() => {
    fetchLists();
    
    // Fetch attendees with list filter
    fetchData({
      entityType: 'attendees',
      listId: listId
    } as FetchOptionsExtended);
  }, [fetchData, fetchLists, listId]);

  // List selection handler
  const handleListSelect = useCallback((selectedListId: string | null) => {
    if (selectedListId) {
      // Navigate to the selected list page
      router.push(`/lists/${selectedListId}`);
    } else {
      // Navigate back to the attendees page
      router.push('/attendees');
    }
  }, [router]);

  // Search handler
  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
    // Fetch with updated search term - reset to page 0
    fetchData({
      page: 0,
      searchTerm: term,
      filters: activeFilters,
      entityType: 'attendees',
      listId: listId
    } as FetchOptionsExtended);
  }, [activeFilters, fetchData, listId]);

  // Filter handler
  const handleFilterChange = useCallback((filters: Array<{
    id: string
    property: string
    operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'is_empty' | 'is_not_empty' | 'greater_than' | 'less_than' | 'not_contains'
    value: string
  }>) => {
    setActiveFilters(filters);
    // Fetch with updated filters - reset to page 0
    fetchData({
      page: 0,
      searchTerm,
      filters,
      entityType: 'attendees',
      listId: listId
    } as FetchOptionsExtended);
  }, [searchTerm, fetchData, listId]);

  // Handle menu toggle
  const handleMenuToggle = useCallback((menu: 'filter' | 'properties' | 'view-settings') => {
    // If clicking the same menu that's open, close it
    setActiveMenu(prev => prev === menu ? null : menu);
  }, []);

  // Tab change handler
  const handleTabChange = useCallback((tab: 'attendees' | 'health-systems' | 'conferences') => {
    router.push(`/${tab}`);
  }, [router]);

  // Click outside handler to close menus
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement
      // Check if click is outside of any menu button or menu content
      if (!target.closest('.menu-button') && !target.closest('.menu-content')) {
        setActiveMenu(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Add handler for loading more attendees in the list
  const handleLoadMore = useCallback(() => {
    // Prevent loading more if already loading
    if (isLoading) {
      console.log('Ignoring load more request - already loading');
      return;
    }
    
    // Calculate the next page
    const nextPage = currentPage + 1;
    
    // Log current state before fetching
    console.log('Loading more list attendees, current page:', currentPage, 'next page:', nextPage, 'timestamp:', new Date().toISOString());
    
    // Fetch with next page, keeping all other filters intact
    fetchData({
      page: nextPage,
      searchTerm,
      filters: activeFilters,
      entityType: 'attendees',
      listId: listId
    } as FetchOptionsExtended);
  }, [currentPage, searchTerm, activeFilters, fetchData, listId, isLoading]);

  return (
    <SelectionProvider>
      <div className="flex h-screen">
        <TabNavigation
          activeTab="attendees"
          onTabChange={handleTabChange}
          counts={counts}
          activeListId={listId}
          onListSelect={handleListSelect}
          refreshLists={fetchLists}
          lists={lists}
        />
        
        <div className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {/* Search and filter row */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 relative z-40">
              <div className="flex flex-col gap-2 w-full lg:max-w-xl">
                <SearchBar 
                  placeholder={`Search within ${currentList?.name || 'list'}...`}
                  onSearch={handleSearch}
                  activeTab="attendees"
                  isLoading={isLoading}
                />
                
                {/* Show results count */}
                <div className="text-sm text-gray-500 ml-1">
                  <span>{currentList ? `${attendees.length} attendees in ${currentList.name}` : 'Loading...'}</span>
                  {searchTerm && (
                    <span> • Filtered by search: &quot;{searchTerm}&quot;</span>
                  )}
                  {activeFilters.length > 0 && (
                    <span> • {activeFilters.length} {activeFilters.length === 1 ? 'filter' : 'filters'} applied</span>
                  )}
                </div>
              </div>
              
              <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 whitespace-nowrap min-w-fit lg:w-auto lg:ml-auto relative z-40">
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
                    listId={listId}
                    onSelectStateChange={setIsSelectingAll}
                  />
                </div>
              </div>
            </div>
            
            {/* Main content area */}
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
              ) : attendees.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64">
                  <p className="text-gray-500 mb-4">No attendees in this list. You can add attendees to this list from the attendees page.</p>
                  <button
                    onClick={() => router.push('/attendees')}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                  >
                    Go to Attendees
                  </button>
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
              
              {/* Add Load More button */}
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
        
        {/* Action bar at the bottom */}
        <ActionBar 
          onEnrichmentComplete={() => fetchData({ 
            entityType: 'attendees', 
            listId: listId 
          } as FetchOptionsExtended)}
          onDefinitiveEnrichmentComplete={() => fetchData({ 
            entityType: 'attendees', 
            listId: listId 
          } as FetchOptionsExtended)}
          onAIEnrichmentComplete={() => fetchData({ 
            entityType: 'attendees', 
            listId: listId 
          } as FetchOptionsExtended)}
          onDelete={() => fetchData({ 
            entityType: 'attendees', 
            listId: listId 
          } as FetchOptionsExtended)}
          conferenceName=""
          activeListId={listId}
          onListDelete={() => {
            router.push('/attendees');
          }}
          refreshLists={fetchLists}
          allColumns={allColumns}
          getFieldsForAllColumns={getFieldsForAllColumns}
          isSelectingAll={isSelectingAll}
        />
      </div>
    </SelectionProvider>
  )
} 