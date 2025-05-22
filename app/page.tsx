'use client'

import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { DataTable } from '@/components/features/common/DataTable'
import { SearchBar } from '@/components/features/common/SearchBar'
import { FilterMenu } from '@/components/features/common/FilterMenu'
import { ItemCard } from '@/components/features/common/ItemCard'
import { AttendeeDetailAdapter } from '@/components/features/attendees/AttendeeDetailAdapter'
import { ConferenceDetailAdapter } from '@/components/features/conferences/ConferenceDetailAdapter'
import { HealthSystemDetailAdapter } from '@/components/features/health-systems/HealthSystemDetailAdapter'
import { ViewSettingsMenu } from '@/components/ui/ViewSettingsMenu'
import { ViewToggle } from '@/components/ui/ViewToggle'
import { TabNavigation } from '@/components/layout/TabNavigation'
import { PropertiesMenu } from '@/components/ui/menus/PropertiesMenu'
import { SelectionProvider, useSelection } from '@/lib/context/SelectionContext'
import { Auth } from '@/components/features/auth/Auth'
import { useAuth } from '@/hooks/useAuth'
import type { Attendee, HealthSystem, Conference } from '@/types'
import { ColumnDef } from '@tanstack/react-table'
import { 
  UserIcon, 
  BuildingOfficeIcon, 
  CalendarIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline'
import { Icon } from '@/components/ui/Icon'
import { useDataFetching } from '@/hooks/useDataFetching'
import { useColumnManagement, IconName } from '@/hooks/useColumnManagement'
import { supabase } from '@/lib/supabase'
import { ActionBar } from '@/components/layout/ActionBar'
import { ApolloEnrichmentResponse } from '@/lib/apollo'
import { handleEnrichmentComplete } from '@/lib/enrichment'
import { DeleteResultsDialog } from '@/components/features/ai-enrichment/DeleteResultsDialog'
import Image from 'next/image'
import { AddEntityButton } from '@/components/features/entities/AddEntityButton'

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

  // Use the data fetching hook with server-side filtering
  const { 
    attendees, 
    healthSystems, 
    conferences, 
    isLoading, 
    error,
    setAttendees,
    setHealthSystems,
    setConferences,
    fetchData,
    totalCount,
    hasMore,
    currentPage
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

  // Memoize current items based on active tab
  const currentItems = useMemo(() => {
    return activeTab === 'attendees' 
      ? attendees 
      : activeTab === 'health-systems' 
        ? healthSystems 
        : conferences;
  }, [activeTab, attendees, healthSystems, conferences]);

  // Use total counts from server for filtered counts
  const filteredCounts = useMemo(() => ({
    attendees: totalCount.attendees,
    'health-systems': totalCount.healthSystems,
    conferences: totalCount.conferences
  }), [totalCount]);

  // Server-side search handler with debounce built into the SearchBar component
  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
    // Fetch with updated search term - reset to page 0
    fetchData({
      page: 0,
      searchTerm: term,
      filters: activeFilters,
      entityType: activeTab
    });
  }, [activeFilters, activeTab, fetchData]);

  // Server-side filter handler
  const handleFilterChange = useCallback((filters: Array<{
    id: string
    property: string
    operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'is_empty' | 'is_not_empty' | 'greater_than' | 'less_than'
    value: string
  }>) => {
    setActiveFilters(filters);
    // Fetch with updated filters - reset to page 0
    fetchData({
      page: 0,
      searchTerm,
      filters,
      entityType: activeTab
    });
  }, [searchTerm, activeTab, fetchData]);

  // Load more data when scrolling
  const handleLoadMore = useCallback(() => {
    if (hasMore && !isLoading) {
      fetchData({
        page: currentPage + 1,
        searchTerm,
        filters: activeFilters,
        entityType: activeTab
      });
    }
  }, [currentPage, searchTerm, activeFilters, activeTab, fetchData, hasMore, isLoading]);

  // Handle menu toggle
  const handleMenuToggle = useCallback((menu: 'filter' | 'properties' | 'view-settings') => {
    // If clicking the same menu that's open, close it
    setActiveMenu(prev => prev === menu ? null : menu);
  }, []);

  // Handle item click to select an item
  const handleItemClick = useCallback(async (item: Attendee | HealthSystem | Conference) => {
    // Fetch complete data with relationships when an item is clicked
    try {
      // Determine entity type
      let fullItem = null;
      
      if ('first_name' in item) {
        // It's an attendee - fetch with health system and conferences
        const { data, error } = await supabase
          .from('attendees')
          .select(`
            *,
            health_systems (*),
            attendee_conferences (
              *,
              conferences (*)
            )
          `)
          .eq('id', item.id)
          .single();
          
        if (error) throw error;
        fullItem = data;
      } 
      else if ('start_date' in item) {
        // It's a conference - fetch with attendees
        const { data, error } = await supabase
          .from('conferences')
          .select(`
            *,
            attendee_conferences (
              *,
              attendees (
                id, first_name, last_name, title, company
              )
            )
          `)
          .eq('id', item.id)
          .single();
          
        if (error) throw error;
        fullItem = data;
      } 
      else {
        // It's a health system - fetch with attendees
        const { data, error } = await supabase
          .from('health_systems')
          .select('*')
          .eq('id', item.id)
          .single();
          
        if (error) throw error;
        
        // Also fetch attendees linked to this health system
        const { data: attendeesData, error: attendeesError } = await supabase
          .from('attendees')
          .select('id, first_name, last_name, title, company, email')
          .eq('health_system_id', item.id);
          
        if (attendeesError) throw attendeesError;
        
        // Combine the data
        fullItem = {
          ...data,
          attendees: attendeesData || []
        };
      }
      
      // Set the selected item with complete relationship data
      setSelectedItem(fullItem || item);
    } catch (err) {
      console.error('Error fetching complete entity data:', err);
      // Fall back to using the item as is if there's an error
      setSelectedItem(item);
    }
  }, []);

  // Handle back button click
  const handleBackClick = useCallback(() => {
    setSelectedItem(null);
  }, []);

  // Handle entity addition
  const handleEntityAdded = useCallback((newEntity: Attendee | HealthSystem | Conference) => {
    // Add the new entity to the appropriate state array
    if ('first_name' in newEntity) {
      setAttendees(prev => [...prev, newEntity as Attendee]);
    } else if ('start_date' in newEntity) {
      setConferences(prev => [...prev, newEntity as Conference]);
    } else {
      setHealthSystems(prev => [...prev, newEntity as HealthSystem]);
    }
  }, [setAttendees, setConferences, setHealthSystems]);

  // Handler for conference updates
  const handleConferenceUpdate = useCallback(async (updatedConference: Conference) => {
    // For database updates we only send the base fields
    const { error } = await supabase
      .from('conferences')
      .update({
        id: updatedConference.id,
        name: updatedConference.name,
        start_date: updatedConference.start_date,
        end_date: updatedConference.end_date,
        location: updatedConference.location
      })
      .eq('id', updatedConference.id);

    if (error) {
      console.error('Error updating conference:', error);
      return;
    }

    // Update UI state
    setConferences(prev => prev.map(c => 
      c.id === updatedConference.id ? updatedConference : c
    ));
    
    // Update selected item if it's the one being edited
    if (selectedItem && selectedItem.id === updatedConference.id) {
      setSelectedItem(updatedConference);
    }
  }, [setConferences, selectedItem]);

  // Handler for health system updates
  const handleHealthSystemUpdate = useCallback(async (updatedHealthSystem: HealthSystem) => {
    // For database updates we only send the base fields
    const { error } = await supabase
      .from('health_systems')
      .update({
        id: updatedHealthSystem.id,
        name: updatedHealthSystem.name,
        definitive_id: updatedHealthSystem.definitive_id,
        website: updatedHealthSystem.website,
        address: updatedHealthSystem.address,
        city: updatedHealthSystem.city,
        state: updatedHealthSystem.state,
        zip: updatedHealthSystem.zip
      })
      .eq('id', updatedHealthSystem.id);

    if (error) {
      console.error('Error updating health system:', error);
      return;
    }
    
    // Update UI state
    setHealthSystems(prev => prev.map(h => 
      h.id === updatedHealthSystem.id ? updatedHealthSystem : h
    ));
    
    // Update selected item if it's the one being edited
    if (selectedItem && selectedItem.id === updatedHealthSystem.id) {
      setSelectedItem(updatedHealthSystem);
    }
  }, [setHealthSystems, selectedItem]);

  // Handler for health system deletion
  const handleHealthSystemDelete = useCallback(async (healthSystemId: string) => {
    try {
      const { error } = await supabase
        .from('health_systems')
        .delete()
        .eq('id', healthSystemId);
      
      if (error) {
        console.error('Error deleting health system:', error);
        return;
      }
      
      // Update UI state
      setHealthSystems(prev => prev.filter(h => h.id !== healthSystemId));
      
      // Clear the selected item if it was the deleted health system
      if (selectedItem && selectedItem.id === healthSystemId) {
        setSelectedItem(null);
      }
    } catch (err) {
      console.error('Unexpected error deleting health system:', err);
    }
  }, [setHealthSystems, selectedItem]);

  // Handler for conference deletion
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
      
      // Update UI state
      setConferences(prev => prev.filter(c => c.id !== conferenceId));
      
      // Clear the selected item if it was the deleted conference
      if (selectedItem && selectedItem.id === conferenceId) {
        setSelectedItem(null);
      }
    } catch (err) {
      console.error('Unexpected error deleting conference:', err);
    }
  }, [setConferences, selectedItem]);

  // Handler for attendee updates
  const handleAttendeeUpdate = useCallback((updatedAttendee: Attendee) => {
    // Update the selected item with the enriched data
    setSelectedItem(updatedAttendee);
    // Update the attendees list
    setAttendees(prev => prev.map(a => a.id === updatedAttendee.id ? updatedAttendee : a));
  }, [setAttendees]);

  // Handler for attendee deletion
  const handleAttendeeDelete = useCallback((deletedAttendeeId: string) => {
    // Clear the selected item
    setSelectedItem(null);
    // Remove the deleted attendee from the list
    setAttendees(prev => prev.filter(a => a.id !== deletedAttendeeId));
  }, [setAttendees]);

  // Handler for clicking on a health system link
  const handleHealthSystemClick = useCallback(async (healthSystemId: string) => {
    try {
      // Fetch the health system with complete data
      const { data, error } = await supabase
        .from('health_systems')
        .select('*')
        .eq('id', healthSystemId)
        .single();
        
      if (error) throw error;
      
      // Also fetch attendees linked to this health system
      const { data: attendeesData, error: attendeesError } = await supabase
        .from('attendees')
        .select('id, first_name, last_name, title, company, email')
        .eq('health_system_id', healthSystemId);
        
      if (attendeesError) throw attendeesError;
      
      // Combine the data
      const healthSystem = {
        ...data,
        attendees: attendeesData || []
      };
      
      // Set active tab and selected item
      setActiveTab('health-systems');
      setSelectedItem(healthSystem);
    } catch (err) {
      console.error('Error fetching health system:', err);
      // Fallback to basic data if available
      const healthSystem = healthSystems.find(hs => hs.id === healthSystemId);
      if (healthSystem) {
        setActiveTab('health-systems');
        setSelectedItem(healthSystem);
      }
    }
  }, [healthSystems]);

  // Handler for clicking on a conference link
  const handleConferenceClick = useCallback(async (conferenceId: string) => {
    try {
      // Fetch the conference with complete data
      const { data, error } = await supabase
        .from('conferences')
        .select(`
          *,
          attendee_conferences (
            *,
            attendees (
              id, first_name, last_name, title, company
            )
          )
        `)
        .eq('id', conferenceId)
        .single();
        
      if (error) throw error;
      
      // Set active tab and selected item
      setActiveTab('conferences');
      setSelectedItem(data);
    } catch (err) {
      console.error('Error fetching conference:', err);
      // Fallback to basic data if available
      const conference = conferences.find(conf => conf.id === conferenceId);
      if (conference) {
        setActiveTab('conferences');
        setSelectedItem(conference);
      }
    }
  }, [conferences]);

  // Handler for clicking on an attendee link
  const handleAttendeeClick = useCallback(async (attendeeId: string) => {
    try {
      // Fetch the attendee with complete data
      const { data, error } = await supabase
        .from('attendees')
        .select(`
          *,
          health_systems (*),
          attendee_conferences (
            *,
            conferences (*)
          )
        `)
        .eq('id', attendeeId)
        .single();
        
      if (error) throw error;
      
      // Set active tab and selected item
      setActiveTab('attendees');
      setSelectedItem(data);
    } catch (err) {
      console.error('Error fetching attendee:', err);
      // Fallback to basic data if available
      const attendee = attendees.find(att => att.id === attendeeId);
      if (attendee) {
        setActiveTab('attendees');
        setSelectedItem(attendee);
      }
    }
  }, [attendees]);

  // Handle tab change with server-side data fetching
  const handleTabChange = useCallback((tab: 'attendees' | 'health-systems' | 'conferences') => {
    // Reset selectedItem when changing tabs
    setSelectedItem(null);
    setActiveTab(tab);
    
    // Fetch data for the new tab
    fetchData({
      page: 0,
      searchTerm,
      filters: activeFilters,
      entityType: tab
    });
  }, [searchTerm, activeFilters, fetchData]);

  // Handle multiple attendee deletion
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
  }, [setAttendees]);

  // Handle list selection with server-side filtering
  const handleListSelect = useCallback(async (listId: string | null) => {
    setActiveListId(listId);
    
    if (!listId) {
      // If no list is selected, fetch all attendees
      fetchData({
        page: 0,
        searchTerm,
        filters: activeFilters,
        entityType: 'attendees'
      });
      return;
    }
    
    try {
      // Fetch attendees that belong to the selected list
      const { data, error } = await supabase
        .from('attendee_lists')
        .select(`
          attendee_id,
          attendees:attendee_id(*)
        `)
        .eq('list_id', listId);
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        setListFilteredAttendees([]);
        return;
      }
      
      // Extract attendee IDs from the join query
      const attendeeIds = data
        .map(item => item.attendee_id)
        .filter(Boolean);
      
      // Create a filter for these attendees
      const listFilter = {
        id: `list-filter-${Date.now()}`,
        property: 'id',
        operator: 'equals' as const,
        value: attendeeIds.join(',') // Join IDs for "in" query
      };
      
      // Apply this filter alongside any other active filters
      const updatedFilters = [...activeFilters.filter(f => f.id !== 'list-filter'), listFilter];
      setActiveFilters(updatedFilters);
      
      // Fetch the filtered attendees
      fetchData({
        page: 0,
        searchTerm,
        filters: updatedFilters,
        entityType: 'attendees'
      });
      
    } catch (err) {
      console.error('Error fetching attendees for list:', err);
    }
  }, [searchTerm, activeFilters, fetchData]);

  // Add scroll event listener for infinite scrolling
  useEffect(() => {
    const handleScroll = () => {
      // Check if user has scrolled to bottom of the page
      if (
        window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.offsetHeight - 200
      ) {
        handleLoadMore();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleLoadMore]);

  // Create a state to track whether this is the initial page load
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Update loading state handling in useEffect to manage initial load state
  useEffect(() => {
    if (!isLoading && isInitialLoad) {
      setIsInitialLoad(false);
    }
  }, [isLoading, isInitialLoad]);

  // Update renderContent to include load more button
  const renderContent = useCallback(() => {
    // Only show full-page loading indicator on initial load
    if (isLoading && isInitialLoad) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent"></div>
        </div>
      );
    }

    // Show error message
    if (error) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 animate-fade-in">
          <p className="font-medium">Error loading data</p>
          <p className="text-sm">{error}</p>
        </div>
      );
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
      );
    }

    // Check if there are no entities to display
    const hasNoItems = currentItems.length === 0;
    if (hasNoItems && !isLoading && !searchTerm && activeFilters.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-64 animate-fade-in">
          <p className="text-gray-500 mb-4">
            No {activeTab === 'attendees' ? 'attendees' : activeTab === 'health-systems' ? 'health systems' : 'conferences'} available. Would you like to add one?
          </p>
          <AddEntityButton 
            entityType={activeTab}
            onEntityAdded={handleEntityAdded}
            currentConferenceName={
              activeTab === 'conferences' && selectedItem ? (selectedItem as Conference).name : undefined
            }
          />
        </div>
      );
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
              activeTab={activeTab}
              isLoading={isLoading}
            />
            
            {/* Show results count */}
            <div className="text-sm text-gray-500 ml-1">
              <span>{filteredCounts[activeTab]} total {activeTab}</span>
              {(searchTerm || activeFilters.length > 0) && (
                <span> • {currentItems.length} results showing</span>
              )}
            </div>
          </div>
          
          <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 whitespace-nowrap min-w-fit lg:w-auto lg:ml-auto relative z-40">
            <SelectAllButton items={currentItems} />
            <AddEntityButton 
              entityType={activeTab}
              onEntityAdded={handleEntityAdded}
              currentConferenceName={
                activeTab === 'conferences' && selectedItem ? (selectedItem as Conference).name : undefined
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
                data={attendees}
                columns={getVisibleColumns() as ColumnDef<Attendee>[]}
                onRowClick={handleItemClick}
              />
            )}
            
            {activeTab === 'health-systems' && (
              <DataTable<HealthSystem>
                data={healthSystems}
                columns={getVisibleColumns() as ColumnDef<HealthSystem>[]}
                onRowClick={handleItemClick}
              />
            )}
            
            {activeTab === 'conferences' && (
              <DataTable<Conference>
                data={conferences}
                columns={getVisibleColumns() as ColumnDef<Conference>[]}
                onRowClick={handleItemClick}
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
        
        {/* Load more button with inline loading state */}
        {hasMore && (
          <div className="flex justify-center mt-6">
            <button
              onClick={handleLoadMore}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin mr-2 h-4 w-4 border-2 border-gray-500 border-t-transparent rounded-full"></div>
                  <span>Loading...</span>
                </div>
              ) : (
                'Load more'
              )}
            </button>
          </div>
        )}

        {/* Show a subtle loading indicator at the top when refreshing data but not on initial load */}
        {isLoading && !isInitialLoad && (
          <div className="fixed top-0 left-0 w-full h-1 bg-primary-50">
            <div className="h-full bg-primary-500 animate-pulse" style={{ width: '30%' }}></div>
          </div>
        )}
      </div>
    );
  }, [
    isLoading, error, selectedItem, currentItems, searchTerm, activeFilters,
    activeTab, activeListId, lists, view, columnsPerRow, activeMenu,
    attendees, healthSystems, conferences, currentPage, isInitialLoad,
    handleBackClick, handleSearch, handleFilterChange, handleMenuToggle,
    handleEntityAdded, handleItemClick, hasMore, handleLoadMore,
    handleHealthSystemClick, handleConferenceClick, handleAttendeeClick,
    handleHealthSystemUpdate, handleHealthSystemDelete, 
    handleConferenceUpdate, handleConferenceDelete,
    handleAttendeeUpdate, handleAttendeeDelete,
    getFieldsForItem, getVisibleColumns, filteredCounts, allColumns
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
  }, [setAttendees, setHealthSystems, setConferences]);

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
                zip: enrichedItem.healthSystem.zip || hs.zip,
                ambulatory_ehr: enrichedItem.healthSystem.ambulatory_ehr,
                net_patient_revenue: enrichedItem.healthSystem.net_patient_revenue,
                number_of_beds: enrichedItem.healthSystem.number_of_beds,
                number_of_hospitals_in_network: enrichedItem.healthSystem.number_of_hospitals_in_network
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
  }, [setHealthSystems]);

  // Handle enrichment complete wrapper
  const handleEnrichmentCompleteWrapper = useCallback(async (enrichedData: ApolloEnrichmentResponse) => {
    try {
      await handleEnrichmentComplete(enrichedData, attendees, setAttendees);
    } catch (error) {
      console.error('Error in enrichment wrapper:', error);
    }
  }, [attendees, setAttendees]);

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
          getFieldsForAllColumns={getFieldsForAllColumns}
        />
      </main>
    </SelectionProvider>
  )
}