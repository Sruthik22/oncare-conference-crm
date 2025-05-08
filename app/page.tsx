'use client'

import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { DataTable } from '@/components/DataTable'
import { SearchBar } from '@/components/SearchBar'
import { FilterMenu } from '@/components/FilterMenu'
import { ItemCard } from '@/components/ItemCard'
import { AttendeeDetailAdapter } from '@/components/AttendeeDetailAdapter'
import { ConferenceDetailAdapter } from '@/components/ConferenceDetailAdapter'
import { HealthSystemDetailAdapter } from '@/components/HealthSystemDetailAdapter'
import { ViewSettingsMenu } from '@/components/ViewSettingsMenu'
import { ViewToggle } from '@/components/ViewToggle'
import { TabNavigation } from '@/components/TabNavigation'
import { PropertiesMenu } from '@/components/PropertiesMenu'
import { SelectionProvider, useSelection } from '@/lib/context/SelectionContext'
import { Auth } from '@/components/Auth'
import { useAuth } from '@/hooks/useAuth'
import type { Attendee, HealthSystem, Conference } from '@/types'
import { ColumnDef } from '@tanstack/react-table'
import { 
  UserIcon, 
  BuildingOfficeIcon, 
  CalendarIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline'
import { Icon } from '@/components/Icon'
import { useDataFetching } from '@/hooks/useDataFetching'
import { useFiltering } from '@/hooks/useFiltering'
import { useColumnManagement, IconName } from '@/hooks/useColumnManagement'
import { supabase } from '@/lib/supabase'
import { ActionBar } from '@/components/ActionBar'
import { ApolloEnrichmentResponse } from '@/lib/apollo'
import { handleEnrichmentComplete } from '@/lib/enrichment'
import { DeleteResultsDialog } from '@/components/DeleteResultsDialog'
import Image from 'next/image'
import { AddEntityButton } from '@/components/AddEntityButton'

// SelectAllButton component
const SelectAllButton = memo(({ 
  items
}: { 
  items: Attendee[] | HealthSystem[] | Conference[]
}) => {
  const { selectAll, deselectAll, selectedItems } = useSelection()
  
  // Check if all items are already selected
  const allSelected = useMemo(() => 
    items.length > 0 && items.every(item => 
      selectedItems.some(selected => selected.id === item.id)
    ), [items, selectedItems]
  );
  
  const handleClick = useCallback(() => {
    if (allSelected) {
      deselectAll();
    } else {
      selectAll(items);
    }
  }, [allSelected, deselectAll, selectAll, items]);
  
  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
    >
      {allSelected ? 'Deselect All' : 'Select All'}
    </button>
  )
});

SelectAllButton.displayName = 'SelectAllButton';

// Extract card view into a separate memoized component
const CardView = memo(({ 
  items, 
  activeTab, 
  getFieldsForItem, 
  onItemClick 
}: { 
  items: Array<Attendee | HealthSystem | Conference>
  activeTab: 'attendees' | 'health-systems' | 'conferences'
  getFieldsForItem: (item: Attendee | HealthSystem | Conference) => Array<{ label: string, value: string, iconName: IconName }>
  onItemClick: (item: Attendee | HealthSystem | Conference) => void
}) => {
  if (activeTab === 'attendees') {
    return (
      <>
        {items.map((attendee) => (
          <ItemCard
            key={attendee.id}
            title={`${(attendee as Attendee).first_name} ${(attendee as Attendee).last_name}`}
            subtitle={(attendee as Attendee).title}
            icon={<Icon icon={UserIcon} size="sm" className="text-gray-400" />}
            onClick={() => onItemClick(attendee)}
            item={attendee}
            fields={getFieldsForItem(attendee)}
          />
        ))}
      </>
    );
  }

  if (activeTab === 'health-systems') {
    return (
      <>
        {items.map((healthSystem) => (
          <ItemCard
            key={healthSystem.id}
            title={(healthSystem as HealthSystem).name}
            subtitle={((healthSystem as HealthSystem).city && (healthSystem as HealthSystem).state) ? `${(healthSystem as HealthSystem).city}, ${(healthSystem as HealthSystem).state}` : ''}
            icon={<Icon icon={BuildingOfficeIcon} size="sm" className="text-gray-400" />}
            onClick={() => onItemClick(healthSystem)}
            item={healthSystem}
            fields={getFieldsForItem(healthSystem)}
          />
        ))}
      </>
    );
  }

  return (
    <>
      {items.map((conference) => (
        <ItemCard
          key={conference.id}
          title={(conference as Conference).name}
          subtitle={(conference as Conference).location}
          icon={<Icon icon={CalendarIcon} size="sm" className="text-gray-400" />}
          onClick={() => onItemClick(conference)}
          item={conference}
          fields={getFieldsForItem(conference)}
        />
      ))}
    </>
  );
});

CardView.displayName = 'CardView';

// Extract the selected item detail rendering into a memoized component
const SelectedItemDetail = memo(({ 
  selectedItem,
  attendees,
  onAttendeeUpdate,
  onAttendeeDelete,
  onHealthSystemClick,
  onConferenceClick,
  onAttendeeClick,
  onHealthSystemUpdate,
  onHealthSystemDelete,
  onConferenceUpdate,
  onConferenceDelete
}: { 
  selectedItem: Attendee | HealthSystem | Conference
  attendees: Attendee[]
  onAttendeeUpdate: (updatedAttendee: Attendee) => void
  onAttendeeDelete: (deletedAttendeeId: string) => void
  onHealthSystemClick: (healthSystemId: string) => void
  onConferenceClick: (conferenceId: string) => void
  onAttendeeClick: (attendeeId: string) => void
  onHealthSystemUpdate: (updatedHealthSystem: HealthSystem) => void
  onHealthSystemDelete: (healthSystemId: string) => void
  onConferenceUpdate: (updatedConference: Conference) => void
  onConferenceDelete: (conferenceId: string) => void
}) => {
  if ('first_name' in selectedItem) {
    const attendee = selectedItem as Attendee;
    const conferenceName = attendee.attendee_conferences?.[0]?.conferences?.name || 'Unknown Conference';
    return <AttendeeDetailAdapter 
      attendee={attendee} 
      conferenceName={conferenceName}
      onUpdate={onAttendeeUpdate}
      onDelete={onAttendeeDelete}
      onHealthSystemClick={onHealthSystemClick}
      onConferenceClick={onConferenceClick}
    />
  } else if ('start_date' in selectedItem) {
    return <ConferenceDetailAdapter 
      conference={selectedItem} 
      onUpdate={onConferenceUpdate}
      onDelete={onConferenceDelete}
      onAttendeeClick={onAttendeeClick}
    />
  } else {
    // Find attendees linked to this health system
    const linkedAttendees = attendees
      .filter(att => att.health_system_id === selectedItem.id)
      .map(att => ({
        id: att.id,
        first_name: att.first_name,
        last_name: att.last_name
      }));
    
    return <HealthSystemDetailAdapter 
      healthSystem={selectedItem} 
      onUpdate={onHealthSystemUpdate}
      onDelete={onHealthSystemDelete}
      onAttendeeClick={onAttendeeClick}
      linkedAttendees={linkedAttendees}
    />
  }
});

SelectedItemDetail.displayName = 'SelectedItemDetail';

export default function Home() {
  const [view, setView] = useState<'table' | 'cards'>('cards')
  const [columnsPerRow, setColumnsPerRow] = useState(3)
  const [activeMenu, setActiveMenu] = useState<'filter' | 'properties' | 'view-settings' | null>(null)
  const [activeTab, setActiveTab] = useState<'attendees' | 'health-systems' | 'conferences'>('attendees')
  const [searchTerm, setSearchTerm] = useState('')
  const [activeFilters, setActiveFilters] = useState<Array<{
    id: string
    property: string
    operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'is_empty' | 'is_not_empty' | 'greater_than' | 'less_than'
    value: string
  }>>([])
  const [selectedItem, setSelectedItem] = useState<Attendee | HealthSystem | Conference | null>(null)
  const [showDeleteResults, setShowDeleteResults] = useState(false)
  const [deleteResults, setDeleteResults] = useState<Array<{
    attendee: Attendee
    success: boolean
    error?: string
  }>>([])
  const [activeListId, setActiveListId] = useState<string | null>(null)
  const [listFilteredAttendees, setListFilteredAttendees] = useState<Attendee[]>([])
  const [lists, setLists] = useState<Array<{ id: string, name: string, count: number }>>([])
  const { user, isLoading: authLoading } = useAuth()

  // Use the data fetching hook
  const { 
    attendees, 
    healthSystems, 
    conferences, 
    isLoading, 
    error,
    setAttendees,
    setHealthSystems,
    setConferences 
  } = useDataFetching()

  // Update the column management hook usage
  const {
    visibleColumns,
    handleColumnToggle,
    getVisibleColumns,
    getFieldsForItem,
    getFieldsForAllColumns,
    allColumns
  } = useColumnManagement({
    activeTab
  })

  // Use the filtering hook for each data type
  const filteredAttendees = useFiltering({
    data: activeListId ? listFilteredAttendees : attendees,
    searchTerm,
    activeFilters,
    getFieldsForAllColumns,
  })

  const filteredHealthSystems = useFiltering({
    data: healthSystems,
    searchTerm,
    activeFilters,
    getFieldsForAllColumns,
  })

  const filteredConferences = useFiltering({
    data: conferences,
    searchTerm,
    activeFilters,
    getFieldsForAllColumns,
  })

  // Memoize current items based on active tab to prevent unnecessary recalculations
  const currentItems = useMemo(() => {
    return activeTab === 'attendees' 
      ? filteredAttendees 
      : activeTab === 'health-systems' 
        ? filteredHealthSystems 
        : filteredConferences;
  }, [activeTab, filteredAttendees, filteredHealthSystems, filteredConferences]);

  // Memoize filtered counts for tabs
  const filteredCounts = useMemo(() => ({
    attendees: filteredAttendees.length,
    'health-systems': filteredHealthSystems.length,
    conferences: filteredConferences.length
  }), [filteredAttendees, filteredHealthSystems, filteredConferences]);

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);

  const handleFilterChange = useCallback((filters: Array<{
    id: string
    property: string
    operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'is_empty' | 'is_not_empty' | 'greater_than' | 'less_than'
    value: string
  }>) => {
    setActiveFilters(filters);
  }, []);

  const handleConferenceUpdate = useCallback(async (updatedConference: Conference) => {
    console.log('Updating conference with data:', updatedConference);
    
    // Only update base fields, not relationships
    const conferenceUpdate = {
      id: updatedConference.id,
      name: updatedConference.name,
      start_date: updatedConference.start_date,
      end_date: updatedConference.end_date,
      location: updatedConference.location
    };

    // For database updates we only send the base fields
    const { error } = await supabase
      .from('conferences')
      .update(conferenceUpdate)
      .eq('id', updatedConference.id);

    if (error) {
      console.error('Error updating conference:', error);
      return;
    }

    // For UI updates, we want to preserve all relationships
    setConferences(prev => prev.map(c => {
      if (c.id === updatedConference.id) {
        // Keep all original fields from the state
        const mergedConference = {
          ...c, // Start with existing data to preserve relationships
          ...updatedConference, // Override with updated fields
        };
        console.log('Merged conference data for UI update:', mergedConference);
        return mergedConference;
      }
      return c;
    }));
    
    // Also update the selected item to show changes immediately
    setSelectedItem(prev => {
      if (prev && prev.id === updatedConference.id) {
        return {
          ...prev, // Keep existing relationships
          ...updatedConference, // Override with updated fields
        };
      }
      return updatedConference;
    });
  }, []);

  const handleHealthSystemUpdate = useCallback(async (updatedHealthSystem: HealthSystem) => {
    console.log('Updating health system with data:', updatedHealthSystem);
    
    // Only update base fields, not relationships
    const healthSystemUpdate = {
      id: updatedHealthSystem.id,
      name: updatedHealthSystem.name,
      definitive_id: updatedHealthSystem.definitive_id,
      website: updatedHealthSystem.website,
      address: updatedHealthSystem.address,
      city: updatedHealthSystem.city,
      state: updatedHealthSystem.state,
      zip: updatedHealthSystem.zip
    };

    // For database updates we only send the base fields
    const { error } = await supabase
      .from('health_systems')
      .update(healthSystemUpdate)
      .eq('id', updatedHealthSystem.id);

    if (error) {
      console.error('Error updating health system:', error);
      return;
    }
    
    // For UI updates, we want to preserve all relationships
    setHealthSystems(prev => prev.map(h => {
      if (h.id === updatedHealthSystem.id) {
        // Keep all original fields from the state
        const mergedHealthSystem = {
          ...h, // Start with existing data to preserve relationships
          ...updatedHealthSystem, // Override with updated fields
        };
        console.log('Merged health system data for UI update:', mergedHealthSystem);
        return mergedHealthSystem;
      }
      return h;
    }));
    
    // Also update the selected item to show changes immediately 
    setSelectedItem(prev => {
      if (prev && prev.id === updatedHealthSystem.id) {
        return {
          ...prev, // Keep existing relationships
          ...updatedHealthSystem, // Override with updated fields
        };
      }
      return updatedHealthSystem;
    });
  }, []);

  const handleHealthSystemDelete = useCallback(async (healthSystemId: string) => {
    try {
      const { error } = await supabase
        .from('health_systems')
        .delete()
        .eq('id', healthSystemId)
      
      if (error) {
        console.error('Error deleting health system:', error)
        return
      }
      
      // Update the health systems list by removing the deleted health system
      setHealthSystems(prevHealthSystems => 
        prevHealthSystems.filter(h => h.id !== healthSystemId)
      )
      
      // Clear the selected item
      setSelectedItem(null)
    } catch (err) {
      console.error('Unexpected error deleting health system:', err)
    }
  }, []);

  const handleConferenceDelete = useCallback(async (conferenceId: string) => {
    try {
      const { error } = await supabase
        .from('conferences')
        .delete()
        .eq('id', conferenceId);
      
      if (error) {
        console.error('Error deleting conference:', error);
        return;
      }
      
      // Update the conferences list by removing the deleted conference
      setConferences(prevConferences => 
        prevConferences.filter(c => c.id !== conferenceId)
      );
      
      // Clear the selected item if it was the deleted conference
      if (selectedItem && 'start_date' in selectedItem && selectedItem.id === conferenceId) {
        setSelectedItem(null);
      }
    } catch (err) {
      console.error('Unexpected error deleting conference:', err);
    }
  }, [selectedItem]);

  const handleEnrichmentCompleteWrapper = useCallback(async (enrichedData: ApolloEnrichmentResponse) => {
    try {
      await handleEnrichmentComplete(enrichedData, attendees, setAttendees);
    } catch (error) {
      console.error('Error in enrichment wrapper:', error);
    }
  }, [attendees]);

  // Handle attendee updates (memoize)
  const handleAttendeeUpdate = useCallback((updatedAttendee: Attendee) => {
    // Update the selected item with the enriched data
    setSelectedItem(updatedAttendee);
    // Update the attendees list
    setAttendees(prevAttendees => 
      prevAttendees.map(a => a.id === updatedAttendee.id ? updatedAttendee : a)
    );
  }, []);

  // Handle attendee deletion (memoize)
  const handleAttendeeDelete = useCallback((deletedAttendeeId: string) => {
    // Clear the selected item
    setSelectedItem(null);
    // Remove the deleted attendee from the list
    setAttendees(prevAttendees => 
      prevAttendees.filter(a => a.id !== deletedAttendeeId)
    );
  }, []);

  // Memoize the entity item click handler
  const handleItemClick = useCallback((item: Attendee | HealthSystem | Conference) => {
    setSelectedItem(item);
  }, []);

  // Memoize the back button click handler
  const handleBackClick = useCallback(() => {
    setSelectedItem(null);
  }, []);

  // Memoize entity addition handler
  const handleEntityAdded = useCallback((newEntity: Attendee | HealthSystem | Conference) => {
    // Add the new entity to the appropriate state array
    if ('first_name' in newEntity) {
      setAttendees(prev => [...prev, newEntity as Attendee]);
    } else if ('start_date' in newEntity) {
      setConferences(prev => [...prev, newEntity as Conference]);
    } else {
      setHealthSystems(prev => [...prev, newEntity as HealthSystem]);
    }
  }, []);

  // Memoize menu toggle handler
  const handleMenuToggle = useCallback((menu: 'filter' | 'properties' | 'view-settings') => {
    // If clicking the same menu that's open, close it
    setActiveMenu(prev => prev === menu ? null : menu);
  }, []);

  // Memoize tab change handler
  const handleTabChange = useCallback((tab: 'attendees' | 'health-systems' | 'conferences') => {
    // Reset selectedItem when changing tabs
    setSelectedItem(null);
    setActiveTab(tab);
  }, []);

  // Memoize handleAttendeesDelete function
  const handleAttendeesDelete = useCallback(async (attendeesToDelete: (Attendee | HealthSystem | Conference)[]) => {
    const filteredAttendees = attendeesToDelete.filter((item): item is Attendee => 'first_name' in item && 'last_name' in item);
    
    if (!filteredAttendees || filteredAttendees.length === 0) return;
    
    const results: Array<{
      attendee: Attendee;
      success: boolean;
      error?: string;
    }> = [];
    
    // Process each attendee sequentially
    for (const attendee of filteredAttendees) {
      try {
        const { error } = await supabase
          .from('attendees')
          .delete()
          .eq('id', attendee.id);
         
        if (error) {
          console.error(`Error deleting attendee ${attendee.id}:`, error);
          results.push({
            attendee,
            success: false,
            error: error.message
          });
        } else {
          results.push({
            attendee,
            success: true
          });
        }
      } catch (err) {
        console.error(`Unexpected error deleting attendee ${attendee.id}:`, err);
        results.push({
          attendee,
          success: false,
          error: err instanceof Error ? err.message : 'An unexpected error occurred'
        });
      }
    }
    
    // Store results and show the dialog
    setDeleteResults(results);
    setShowDeleteResults(true);
    
    // Update the attendees list by removing successfully deleted attendees
    const successfullyDeletedIds = results
      .filter(result => result.success)
      .map(result => result.attendee.id);
    
    setAttendees(prevAttendees => 
      prevAttendees.filter(a => !successfullyDeletedIds.includes(a.id))
    );
  }, []);

  const handleHealthSystemClick = useCallback((healthSystemId: string) => {
    // Find the health system and set it as the selected item
    const healthSystem = healthSystems.find(hs => hs.id === healthSystemId);
    if (healthSystem) {
      setActiveTab('health-systems');
      setSelectedItem(healthSystem);
    }
  }, [healthSystems]);
  
  const handleConferenceClick = useCallback((conferenceId: string) => {
    // Find the conference and set it as the selected item
    const conference = conferences.find(conf => conf.id === conferenceId);
    if (conference) {
      setActiveTab('conferences');
      setSelectedItem(conference);
    }
  }, [conferences]);
  
  const handleAttendeeClick = useCallback((attendeeId: string) => {
    // Find the attendee and set it as the selected item
    const attendee = attendees.find(att => att.id === attendeeId);
    if (attendee) {
      setActiveTab('attendees');
      setSelectedItem(attendee);
    }
  }, [attendees]);
  
  const handleListSelect = useCallback(async (listId: string | null) => {
    setActiveListId(listId)
    
    if (!listId) {
      // If no list is selected, clear the list filter
      setListFilteredAttendees([])
      return
    }
    
    try {
      // Fetch attendees that belong to the selected list
      const { data, error } = await supabase
        .from('attendee_lists')
        .select(`
          attendee_id,
          attendees:attendee_id(*)
        `)
        .eq('list_id', listId)
      
      if (error) throw error
      
      if (!data || data.length === 0) {
        setListFilteredAttendees([])
        return
      }
      
      // Extract attendees from the join query
      const attendeesInList = data
        .map(item => item.attendees as unknown as Attendee)
        .filter(Boolean)
      setListFilteredAttendees(attendeesInList)
    } catch (err) {
      console.error('Error fetching attendees for list:', err)
      setListFilteredAttendees([])
    }
  }, []);

  // Replace renderCardView with the memoized component
  const renderContent = useCallback(() => {
    // Show loading indicator
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent"></div>
        </div>
      )
    }

    // Show error message
    if (error) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 animate-fade-in">
          <p className="font-medium">Error loading data</p>
          <p className="text-sm">{error}</p>
        </div>
      )
    }

    if (selectedItem) {
      return (
        <div className="space-y-6 animate-fade-in">
          <button
            onClick={handleBackClick}
            className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <Icon icon={ArrowLeftIcon} size="xs" className="mr-1 text-gray-400" />
            Back to list
          </button>
          
          <SelectedItemDetail 
            selectedItem={selectedItem}
            attendees={attendees}
            onAttendeeUpdate={handleAttendeeUpdate}
            onAttendeeDelete={handleAttendeeDelete}
            onHealthSystemClick={handleHealthSystemClick}
            onConferenceClick={handleConferenceClick}
            onAttendeeClick={handleAttendeeClick}
            onHealthSystemUpdate={handleHealthSystemUpdate}
            onHealthSystemDelete={handleHealthSystemDelete}
            onConferenceUpdate={handleConferenceUpdate}
            onConferenceDelete={handleConferenceDelete}
          />
        </div>
      )
    }

    // Check if there are no entities to display
    const hasNoItems = currentItems.length === 0;
    if (hasNoItems && !isLoading && !searchTerm && activeFilters.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-64 animate-fade-in">
          <p className="text-gray-500 mb-4">
            No {
              activeTab === 'attendees' ? 'attendees' : 
              activeTab === 'health-systems' ? 'health systems' : 
              'conferences'
            } available. Would you like to add one?
          </p>
          <AddEntityButton 
            entityType={activeTab}
            onEntityAdded={handleEntityAdded}
            currentConferenceName={
              activeTab === 'conferences' && selectedItem 
                ? (selectedItem as Conference).name 
                : undefined
            }
          />
        </div>
      )
    }

    return (
      <div className="space-y-6 animate-fade-in">
        {activeListId && activeTab === 'attendees' && (
          <div className="bg-indigo-50 px-4 py-2 border-b border-indigo-100 flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-sm text-indigo-700">Filtered by list</span>
              <span className="ml-2 inline-flex items-center rounded-md bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-700">
                {lists.find((list) => list.id === activeListId)?.name || 'Selected list'}
              </span>
            </div>
            <button 
              onClick={() => handleListSelect(null)}
              className="text-indigo-700 hover:text-indigo-900 text-sm font-medium"
            >
              Clear filter
            </button>
          </div>
        )}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 relative z-40">
          <div className="flex flex-col gap-2 w-full lg:max-w-xl">
            <SearchBar 
              placeholder={`Search ${activeTab === 'health-systems' ? 'Health Systems' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}...`}
              onSearch={handleSearch}
              onFilterChange={handleFilterChange}
              activeTab={activeTab}
              isLoading={isLoading}
            />
            
            {/* Show results count when filtering is active */}
            {(searchTerm || activeFilters.length > 0 || activeListId) && (
              <div className="text-sm text-gray-500 ml-1">
                <span>{currentItems.length} results showing</span>
              </div>
            )}
          </div>
          
          <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 whitespace-nowrap min-w-fit lg:w-auto lg:ml-auto relative z-40">
            <SelectAllButton items={currentItems} />
            <AddEntityButton 
              entityType={activeTab}
              onEntityAdded={handleEntityAdded}
              currentConferenceName={
                activeTab === 'conferences' && selectedItem 
                  ? (selectedItem as Conference).name 
                  : undefined
              }
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
              visibleColumns={visibleColumns[activeTab]}
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
            </div>
          </div>
        </div>
        
        {view === 'table' ? (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-100">
            {activeTab === 'attendees' && (
              <DataTable<Attendee>
                data={filteredAttendees}
                columns={getVisibleColumns() as ColumnDef<Attendee>[]}
                onRowClick={setSelectedItem}
              />
            )}
            
            {activeTab === 'health-systems' && (
              <DataTable<HealthSystem>
                data={filteredHealthSystems}
                columns={getVisibleColumns() as ColumnDef<HealthSystem>[]}
                onRowClick={setSelectedItem}
              />
            )}
            
            {activeTab === 'conferences' && (
              <DataTable<Conference>
                data={filteredConferences}
                columns={getVisibleColumns() as ColumnDef<Conference>[]}
                onRowClick={setSelectedItem}
              />
            )}
          </div>
        ) : (
          <div className={`grid gap-4 relative z-0 ${
            columnsPerRow === 1 ? 'grid-cols-1' :
            columnsPerRow === 2 ? 'grid-cols-1 sm:grid-cols-2' :
            columnsPerRow === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' :
            'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
          }`}>
            <CardView 
              items={currentItems}
              activeTab={activeTab}
              getFieldsForItem={getFieldsForItem}
              onItemClick={handleItemClick}
            />
          </div>
        )}
      </div>
    )
  }, [
    isLoading, error, selectedItem, currentItems, searchTerm, activeFilters,
    activeTab, activeListId, lists, view, columnsPerRow, activeMenu,
    filteredAttendees, filteredHealthSystems, filteredConferences,
    handleBackClick, handleSearch, handleFilterChange, handleMenuToggle,
    handleEntityAdded, handleItemClick, attendees,
    handleHealthSystemClick, handleConferenceClick, handleAttendeeClick,
    handleHealthSystemUpdate, handleHealthSystemDelete, 
    handleConferenceUpdate, handleConferenceDelete,
    handleAttendeeUpdate, handleAttendeeDelete,
    getFieldsForItem, getVisibleColumns, filteredCounts
  ]);

  // Fetch lists function to be shared between components
  const fetchLists = useCallback(async () => {
    try {
      // Fetch all lists
      const { data: listsData, error: listsError } = await supabase
        .from('lists')
        .select('id, name')
  
      if (listsError) throw new Error(listsError.message)
      
      if (!listsData) {
        setLists([])
        return
      }
      
      // Get counts for each list
      const listsWithCounts = await Promise.all(
        listsData.map(async (list) => {
          const { count, error: countError } = await supabase
            .from('attendee_lists')
            .select('id', { count: 'exact', head: true })
            .eq('list_id', list.id)
          
          return {
            ...list,
            count: countError ? 0 : count || 0
          }
        })
      )
      
      setLists(listsWithCounts)
    } catch (err) {
      console.error('Failed to fetch lists', err)
      setLists([])
    }
  }, []);

  // Fetch lists when component mounts
  useEffect(() => {
    fetchLists()
  }, [fetchLists])

  // Function to handle deleting a list
  const handleListDelete = useCallback(async (listId: string) => {
    try {
      // First, delete all attendee_lists associations
      const { error: deleteAssociationsError } = await supabase
        .from('attendee_lists')
        .delete()
        .eq('list_id', listId);
      
      if (deleteAssociationsError) throw new Error(deleteAssociationsError.message);
      
      // Then delete the list itself
      const { error: deleteListError } = await supabase
        .from('lists')
        .delete()
        .eq('id', listId);
      
      if (deleteListError) throw new Error(deleteListError.message);
      
      // Clear the active list selection
      setActiveListId(null);
      
      // Clear the filtered attendees
      setListFilteredAttendees([]);
      
      // Update the lists state directly for immediate UI update
      setLists(prevLists => prevLists.filter(list => list.id !== listId));
      
      // Refresh the lists to ensure data consistency
      fetchLists();
    } catch (err) {
      console.error('Failed to delete list:', err);
      alert('Failed to delete list: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }, [fetchLists]);

  // Handle AI enrichment completion
  const handleAIEnrichmentComplete = useCallback(async (enrichedData: any) => {
    console.log('AI Enrichment completed:', enrichedData)
    
    // Determine which data type was enriched and refresh accordingly
    const successfullyEnriched = enrichedData.filter((result: any) => result.success)
    
    if (successfullyEnriched.length > 0) {
      // Check the type of the first item to determine which data to refresh
      const firstItem = successfullyEnriched[0].item
      
      if ('first_name' in firstItem && 'last_name' in firstItem) {
        // Refresh attendees
        const { data } = await supabase
          .from('attendees')
          .select('*, health_systems(*)')
        
        if (data) {
          setAttendees(data as Attendee[])
        }
      } else if ('name' in firstItem && !('start_date' in firstItem)) {
        // Refresh health systems
        const { data } = await supabase
          .from('health_systems')
          .select('*')
        
        if (data) {
          setHealthSystems(data as HealthSystem[])
        }
      } else if ('start_date' in firstItem) {
        // Refresh conferences
        const { data } = await supabase
          .from('conferences')
          .select('*')
        
        if (data) {
          setConferences(data as Conference[])
        }
      }
    }
  }, []);

  // Handle definitive enrichment completion
  const handleDefinitiveEnrichmentComplete = useCallback(async (enrichedData: any) => {
    try {
      // Since there's no fetchHealthSystems function, we'll use the existing setHealthSystems state function
      // to update health systems that were enriched
      const successfullyEnriched = enrichedData.filter((item: any) => item.success);
     
      if (successfullyEnriched.length > 0) {
        // Update health systems in the local state
        setHealthSystems(prevHealthSystems => 
          prevHealthSystems.map(hs => {
            // Find if this health system was enriched
            const enrichedItem = successfullyEnriched.find((item: any) => 
              item.healthSystem.id === hs.id
            );
            
            // If it was enriched, update it with new data
            if (enrichedItem) {
              return {
                ...hs,
                definitive_id: enrichedItem.healthSystem.definitive_id,
                website: enrichedItem.healthSystem.website || hs.website,
                address: enrichedItem.healthSystem.address || hs.address,
                city: enrichedItem.healthSystem.city || hs.city,
                state: enrichedItem.healthSystem.state || hs.state,
                zip: enrichedItem.healthSystem.zip || hs.zip
              };
            }
            
            // Otherwise return the original health system
            return hs;
          })
        );
      }
    } catch (error) {
      console.error('Error handling Definitive enrichment completion:', error);
    }
  }, []);

  // Memoize the conference name for ActionBar
  const conferenceName = useMemo(() => {
    if (activeListId && lists.find(list => list.id === activeListId)) {
      return lists.find(list => list.id === activeListId)?.name || '';
    }
    return (activeTab === 'conferences' && selectedItem ? (selectedItem as Conference).name : '');
  }, [activeListId, lists, activeTab, selectedItem]);

  // Add a click outside handler to close all menus
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

  // Render a loading spinner while auth state is being determined
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-600 border-t-transparent"></div>
      </div>
    )
  }

  // If not authenticated, show the auth form centered on the page
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
        <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-md">
          <div className="flex justify-center mb-8">
            <Image 
              src="/oncare_logo.svg" 
              alt="Oncare Logo"
              width={150}
              height={48}
              className="h-12 w-auto"
            />
          </div>
          <Auth />
        </div>
      </div>
    )
  }

  return (
    <SelectionProvider>
      <main className="flex h-screen flex-col">
        <div className="flex flex-1 overflow-hidden">
          <TabNavigation 
            activeTab={activeTab} 
            onTabChange={handleTabChange}
            counts={{
              attendees: attendees.length,
              'health-systems': healthSystems.length,
              conferences: conferences.length
            }}
            filteredCounts={filteredCounts}
            activeListId={activeListId}
            onListSelect={handleListSelect}
            refreshLists={fetchLists}
            lists={lists}
          />
          
          <div className="flex-1 overflow-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24">
              {renderContent()}
            </div>
          </div>
        </div>
        
        <DeleteResultsDialog 
          isOpen={showDeleteResults}
          onClose={() => setShowDeleteResults(false)}
          results={deleteResults}
        />
        
        <ActionBar 
          onEnrichmentComplete={handleEnrichmentCompleteWrapper}
          onDefinitiveEnrichmentComplete={handleDefinitiveEnrichmentComplete}
          onAIEnrichmentComplete={handleAIEnrichmentComplete}
          onDelete={handleAttendeesDelete}
          conferenceName={conferenceName}
          activeListId={activeListId}
          onListDelete={handleListDelete}
          refreshLists={fetchLists}
          allColumns={allColumns}
          isLoading={isLoading}
          activeTab={activeTab}
          getFieldsForAllColumns={getFieldsForAllColumns}
        />
      </main>
    </SelectionProvider>
  )
}