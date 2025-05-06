'use client'

import { useState, useEffect, useMemo } from 'react'
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
import { ColumnDef, CellContext } from '@tanstack/react-table'
import { 
  UserIcon, 
  BuildingOfficeIcon, 
  CalendarIcon, 
  MapPinIcon,
  EnvelopeIcon,
  ArrowLeftIcon,
  PhoneIcon,
  BriefcaseIcon,
  GlobeAltIcon,
  ViewColumnsIcon,
} from '@heroicons/react/24/outline'
import { Icon } from '@/components/Icon'
import { useDataFetching } from '@/hooks/useDataFetching'
import { useFiltering } from '@/hooks/useFiltering'
import { useColumnManagement } from '@/hooks/useColumnManagement'
import { supabase } from '@/lib/supabase'
import { ActionBar } from '@/components/ActionBar'
import { ApolloEnrichmentResponse } from '@/lib/apollo'
import { handleEnrichmentComplete } from '@/lib/enrichment'
import { DeleteResultsDialog } from '@/components/DeleteResultsDialog'
import Image from 'next/image'
import { AddEntityButton } from '@/components/AddEntityButton'

// SelectAllButton component
function SelectAllButton({ 
  items
}: { 
  items: Attendee[] | HealthSystem[] | Conference[]
}) {
  const { selectAll, deselectAll, selectedItems } = useSelection()
  
  // Check if all items are already selected
  const allSelected = items.length > 0 && items.every(item => 
    selectedItems.some(selected => selected.id === item.id)
  );
  
  const handleClick = () => {
    if (allSelected) {
      deselectAll();
    } else {
      selectAll(items);
    }
  };
  
  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
    >
      {allSelected ? 'Deselect All' : 'Select All'}
    </button>
  )
}

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

  // Detect custom columns from data
  const detectCustomColumns = <T extends Record<string, any>>(data: T[]) => {
    if (!data || data.length === 0) return [] as ColumnDef<T>[]
    
    const customColumns: ColumnDef<T>[] = []
    const firstItem = data[0]
    
    // Get all object keys
    Object.keys(firstItem).forEach(key => {
      // Skip standard columns and internal fields
      const standardKeys = ['id', 'first_name', 'last_name', 'email', 'phone', 'title', 'company', 
        'name', 'city', 'state', 'website', 'location', 'start_date', 'end_date', 
        'created_at', 'updated_at', 'definitive_id', 'address', 'zip', 'revenue',
        'linkedin_url', 'health_systems', 'health_system_id']
      
      if (!standardKeys.includes(key) && !key.startsWith('_')) {
        // This appears to be a custom column
        customColumns.push({
          id: key,
          header: key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
          accessorKey: key as keyof T,
          cell: (info) => {
            const value = info.getValue()
            // Format boolean values as Yes/No
            if (typeof value === 'boolean') {
              return value ? 'Yes' : 'No'
            }
            return value
          }
        })
      }
    })
    
    return customColumns
  }

  // Enhance column definitions with custom columns
  const attendeesCustomColumns = useMemo(() => {
    return detectCustomColumns<Attendee>(attendees)
  }, [attendees])
  
  const healthSystemsCustomColumns = useMemo(() => {
    return detectCustomColumns<HealthSystem>(healthSystems)
  }, [healthSystems])
  
  const conferencesCustomColumns = useMemo(() => {
    return detectCustomColumns<Conference>(conferences)
  }, [conferences])

  // Update the column definitions to include custom columns
  const attendeeColumns = useMemo<ColumnDef<Attendee>[]>(() => [
    {
      id: 'name',
      header: 'Name',
      accessorFn: (row) => `${row.first_name} ${row.last_name}`,
    },
    { id: 'email', header: 'Email', accessorKey: 'email' },
    { id: 'phone', header: 'Phone', accessorKey: 'phone' },
    { id: 'title', header: 'Title', accessorKey: 'title' },
    { id: 'company', header: 'Company', accessorKey: 'company' },
    ...attendeesCustomColumns
  ], [attendeesCustomColumns])

  const healthSystemColumns = useMemo<ColumnDef<HealthSystem>[]>(() => [
    { id: 'name', header: 'Name', accessorKey: 'name' },
    { id: 'location', header: 'Location', accessorFn: (row) => `${row.city || ''}, ${row.state || ''}` },
    { id: 'website', header: 'Website', accessorKey: 'website' },
    ...healthSystemsCustomColumns
  ], [healthSystemsCustomColumns])

  const conferenceColumns = useMemo<ColumnDef<Conference>[]>(() => [
    { id: 'name', header: 'Name', accessorKey: 'name' },
    { 
      id: 'date',
      header: 'Date', 
      accessorFn: (row) => {
        if (!row.start_date) return ''
        const start = new Date(row.start_date).toLocaleDateString()
        const end = row.end_date ? new Date(row.end_date).toLocaleDateString() : null
        return end ? `${start} - ${end}` : start
      }
    },
    { id: 'location', header: 'Location', accessorKey: 'location' },
    ...conferencesCustomColumns
  ], [conferencesCustomColumns])

  // Get all available columns for current tab
  const getAllColumns = useMemo(() => {
    switch (activeTab) {
      case 'attendees':
        return attendeeColumns.map(col => ({
          ...col,
          accessorFn: (row: Attendee | HealthSystem | Conference) => {
            if ('first_name' in row) {
              const attendee = row as Attendee
              if (col.id === 'name') {
                return `${attendee.first_name} ${attendee.last_name}`
              }
              return attendee[col.id as keyof Attendee]
            }
            return undefined
          },
          cell: (info: CellContext<Attendee | HealthSystem | Conference, unknown>) => {
            const row = info.row.original
            if ('first_name' in row) {
              return typeof col.cell === 'function' ? col.cell(info as CellContext<Attendee, unknown>) : info.getValue()
            }
            return null
          }
        })) as ColumnDef<Attendee | HealthSystem | Conference>[]
      case 'health-systems':
        return healthSystemColumns.map(col => ({
          ...col,
          accessorFn: (row: Attendee | HealthSystem | Conference) => {
            if ('name' in row && !('first_name' in row)) {
              const healthSystem = row as HealthSystem
              if (col.id === 'location') {
                return `${healthSystem.city || ''}, ${healthSystem.state || ''}`
              }
              return healthSystem[col.id as keyof HealthSystem]
            }
            return undefined
          },
          cell: (info: CellContext<Attendee | HealthSystem | Conference, unknown>) => {
            const row = info.row.original
            if ('name' in row && !('first_name' in row)) {
              return typeof col.cell === 'function' ? col.cell(info as CellContext<HealthSystem, unknown>) : info.getValue()
            }
            return null
          }
        })) as ColumnDef<Attendee | HealthSystem | Conference>[]
      case 'conferences':
        return conferenceColumns.map(col => ({
          ...col,
          accessorFn: (row: Attendee | HealthSystem | Conference) => {
            if ('start_date' in row) {
              const conference = row as Conference
              if (col.id === 'date') {
                if (!conference.start_date) return ''
                const start = new Date(conference.start_date).toLocaleDateString()
                const end = conference.end_date ? new Date(conference.end_date).toLocaleDateString() : null
                return end ? `${start} - ${end}` : start
              }
              return conference[col.id as keyof Conference]
            }
            return undefined
          },
          cell: (info: CellContext<Attendee | HealthSystem | Conference, unknown>) => {
            const row = info.row.original
            if ('start_date' in row) {
              return typeof col.cell === 'function' ? col.cell(info as CellContext<Conference, unknown>) : info.getValue()
            }
            return null
          }
        })) as ColumnDef<Attendee | HealthSystem | Conference>[]
      default:
        return []
    }
  }, [activeTab, attendeeColumns, healthSystemColumns, conferenceColumns])

  // Use the column management hook
  const {
    visibleColumns,
    columnOrder,
    setColumnOrder,
    handleColumnToggle,
    getVisibleColumns,
  } = useColumnManagement({
    activeTab,
    view,
    columns: getAllColumns,
  })

  // Use the filtering hook for each data type
  const filteredAttendees = useFiltering({
    data: activeListId ? listFilteredAttendees : attendees,
    searchTerm,
    activeFilters,
  })

  const filteredHealthSystems = useFiltering({
    data: healthSystems,
    searchTerm,
    activeFilters,
  })

  const filteredConferences = useFiltering({
    data: conferences,
    searchTerm,
    activeFilters,
  })

  const handleSearch = (term: string) => {
    setSearchTerm(term)
  }

  const handleFilterChange = (filters: Array<{
    id: string
    property: string
    operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'is_empty' | 'is_not_empty' | 'greater_than' | 'less_than'
    value: string
  }>) => {
    setActiveFilters(filters)
  }

  const handleConferenceUpdate = async (updatedConference: Conference) => {
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
  }

  const handleHealthSystemUpdate = async (updatedHealthSystem: HealthSystem) => {
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
  }

  const handleHealthSystemDelete = async (healthSystemId: string) => {
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
  }

  const handleConferenceDelete = async (conferenceId: string) => {
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
  };

  const handleEnrichmentCompleteWrapper = async (enrichedData: ApolloEnrichmentResponse) => {
    try {
      await handleEnrichmentComplete(enrichedData, attendees, setAttendees);
    } catch (error) {
      console.error('Error in enrichment wrapper:', error);
    }
  };

  // Update handleBulkDelete to handle different entity types
  const handleBulkDelete = async (selectedItems: Array<Attendee | HealthSystem | Conference>) => {
    try {
      // Separate items by type
      const attendeesToDelete = selectedItems.filter((item): item is Attendee => 
        'first_name' in item && 'last_name' in item
      );
      
      const healthSystemsToDelete = selectedItems.filter((item): item is HealthSystem => 
        'name' in item && !('first_name' in item) && !('start_date' in item)
      );
      
      const conferencesToDelete = selectedItems.filter((item): item is Conference => 
        'name' in item && 'start_date' in item
      );
      
      // Handle each type appropriately
      if (attendeesToDelete.length > 0) {
        await handleAttendeesDelete(attendeesToDelete);
      }
      
      if (healthSystemsToDelete.length > 0) {
        for (const healthSystem of healthSystemsToDelete) {
          await handleHealthSystemDelete(healthSystem.id);
        }
      }
      
      if (conferencesToDelete.length > 0) {
        for (const conference of conferencesToDelete) {
          await handleConferenceDelete(conference.id);
        }
      }
    } catch (error) {
      console.error('Error in bulk delete:', error);
    }
  };
  
  const handleHealthSystemClick = (healthSystemId: string) => {
    // Find the health system and set it as the selected item
    const healthSystem = healthSystems.find(hs => hs.id === healthSystemId);
    if (healthSystem) {
      setActiveTab('health-systems');
      setSelectedItem(healthSystem);
    }
  }
  
  const handleConferenceClick = (conferenceId: string) => {
    // Find the conference and set it as the selected item
    const conference = conferences.find(conf => conf.id === conferenceId);
    if (conference) {
      setActiveTab('conferences');
      setSelectedItem(conference);
    }
  }
  
  const handleAttendeeClick = (attendeeId: string) => {
    // Find the attendee and set it as the selected item
    const attendee = attendees.find(att => att.id === attendeeId);
    if (attendee) {
      setActiveTab('attendees');
      setSelectedItem(attendee);
    }
  }
  
  const renderSelectedItemDetail = () => {
    if (!selectedItem) return null

    if ('first_name' in selectedItem) {
      const attendee = selectedItem as Attendee;
      const conferenceName = attendee.attendee_conferences?.[0]?.conferences?.name || 'Unknown Conference';
      return <AttendeeDetailAdapter 
        attendee={attendee} 
        conferenceName={conferenceName}
        onUpdate={(updatedAttendee) => {
          // Update the selected item with the enriched data
          setSelectedItem(updatedAttendee);
          // Update the attendees list
          setAttendees(prevAttendees => 
            prevAttendees.map(a => a.id === updatedAttendee.id ? updatedAttendee : a)
          );
        }}
        onDelete={(deletedAttendeeId) => {
          // Clear the selected item
          setSelectedItem(null);
          // Remove the deleted attendee from the list
          setAttendees(prevAttendees => 
            prevAttendees.filter(a => a.id !== deletedAttendeeId)
          );
        }}
        onHealthSystemClick={handleHealthSystemClick}
        onConferenceClick={handleConferenceClick}
      />
    } else if ('start_date' in selectedItem) {
      return <ConferenceDetailAdapter 
        conference={selectedItem} 
        onUpdate={handleConferenceUpdate}
        onDelete={handleConferenceDelete}
        onAttendeeClick={handleAttendeeClick}
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
        onUpdate={handleHealthSystemUpdate}
        onDelete={handleHealthSystemDelete}
        onAttendeeClick={handleAttendeeClick}
        linkedAttendees={linkedAttendees}
      />
    }
  }

  const renderCardView = () => {
    const getColumnIcon = (columnId: string) => {
      switch (columnId) {
        case 'name':
        case 'first_name':
        case 'last_name':
          return <Icon icon={UserIcon} size="sm" className="text-gray-400" />
        case 'email':
          return <Icon icon={EnvelopeIcon} size="sm" className="text-gray-400" />
        case 'phone':
          return <Icon icon={PhoneIcon} size="sm" className="text-gray-400" />
        case 'title':
          return <Icon icon={BriefcaseIcon} size="sm" className="text-gray-400" />
        case 'company':
          return <Icon icon={BuildingOfficeIcon} size="sm" className="text-gray-400" />
        case 'location':
        case 'address':
        case 'city':
        case 'state':
        case 'zip':
          return <Icon icon={MapPinIcon} size="sm" className="text-gray-400" />
        case 'website':
        case 'linkedin_url':
          return <Icon icon={GlobeAltIcon} size="sm" className="text-gray-400" />
        case 'date':
        case 'start_date':
        case 'end_date':
        case 'created_at':
        case 'updated_at':
          return <Icon icon={CalendarIcon} size="sm" className="text-gray-400" />
        default:
          // Try to determine icon based on columnId
          if (columnId.includes('email')) {
            return <Icon icon={EnvelopeIcon} size="sm" className="text-gray-400" />
          } else if (columnId.includes('phone')) {
            return <Icon icon={PhoneIcon} size="sm" className="text-gray-400" />
          } else if (columnId.includes('date')) {
            return <Icon icon={CalendarIcon} size="sm" className="text-gray-400" />
          } else if (columnId.includes('url') || columnId.includes('website')) {
            return <Icon icon={GlobeAltIcon} size="sm" className="text-gray-400" />
          } else if (columnId.includes('address') || columnId.includes('location')) {
            return <Icon icon={MapPinIcon} size="sm" className="text-gray-400" />
          } else if (columnId.includes('company') || columnId.includes('system')) {
            return <Icon icon={BuildingOfficeIcon} size="sm" className="text-gray-400" />
          }
          return <Icon icon={ViewColumnsIcon} size="sm" className="text-gray-400" />
      }
    }

    const getVisibleFields = (item: Attendee | HealthSystem | Conference) => {
      const fields: { label: string; value: string; icon: React.ReactNode }[] = []
      const visibleColumnIds = visibleColumns[activeTab]
      
      // Use columnOrder to maintain the same order as in table view
      // If a column is in visibleColumnIds but not in columnOrder, it will be added at the end
      const orderedVisibleColumns = columnOrder
        .filter(id => visibleColumnIds.includes(id) && id !== 'name')
        .concat(visibleColumnIds.filter(id => !columnOrder.includes(id) && id !== 'name'))
      
      orderedVisibleColumns.forEach(id => {
        const column = getAllColumns.find((col) => col.id === id)
        if (!column) return

        let value = ''
        if ('accessorKey' in column && column.accessorKey) {
          const key = column.accessorKey as keyof (Attendee | HealthSystem | Conference)
          value = String(item[key] || '')
        } else if ('accessorFn' in column && typeof column.accessorFn === 'function') {
          value = String(column.accessorFn(item, 0) || '')
        }

        fields.push({
          label: String(column.header),
          value: value,
          icon: getColumnIcon(String(column.id))
        })
      })

      return fields
    }

    if (activeTab === 'attendees') {
      return filteredAttendees.map((attendee) => (
        <ItemCard
          key={attendee.id}
          title={`${attendee.first_name} ${attendee.last_name}`}
          subtitle={attendee.title}
          icon={<Icon icon={UserIcon} size="sm" className="text-gray-400" />}
          onClick={() => setSelectedItem(attendee)}
          item={attendee}
          itemType="attendee"
          fields={getVisibleFields(attendee)}
        />
      ))
    }

    if (activeTab === 'health-systems') {
      return filteredHealthSystems.map((healthSystem) => (
        <ItemCard
          key={healthSystem.id}
          title={healthSystem.name}
          subtitle={`${healthSystem.city || ''}, ${healthSystem.state || ''}`}
          icon={<Icon icon={BuildingOfficeIcon} size="sm" className="text-gray-400" />}
          onClick={() => setSelectedItem(healthSystem)}
          item={healthSystem}
          itemType="healthSystem"
          fields={getVisibleFields(healthSystem)}
        />
      ))
    }

    return filteredConferences.map((conference) => (
      <ItemCard
        key={conference.id}
        title={conference.name}
        subtitle={conference.location}
        icon={<Icon icon={CalendarIcon} size="sm" className="text-gray-400" />}
        onClick={() => setSelectedItem(conference)}
        item={conference}
        itemType="conference"
        fields={getVisibleFields(conference)}
      />
    ))
  }

  const renderContent = () => {
    // Get current filtered items based on active tab
    const currentItems = activeTab === 'attendees' 
      ? filteredAttendees 
      : activeTab === 'health-systems' 
        ? filteredHealthSystems 
        : filteredConferences;

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
            onClick={() => setSelectedItem(null)}
            className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <Icon icon={ArrowLeftIcon} size="xs" className="mr-1 text-gray-400" />
            Back to list
          </button>
          
          {renderSelectedItemDetail()}
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
            onEntityAdded={(newEntity) => {
              // Add the new entity to the appropriate state array
              if ('first_name' in newEntity) {
                setAttendees([...attendees, newEntity as Attendee]);
              } else if ('start_date' in newEntity) {
                setConferences([...conferences, newEntity as Conference]);
              } else {
                setHealthSystems([...healthSystems, newEntity as HealthSystem]);
              }
            }}
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
          <div className="flex items-center gap-4 w-full lg:max-w-xl">
            <SearchBar 
              placeholder={`Search ${activeTab === 'health-systems' ? 'Health Systems' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}...`}
              onSearch={handleSearch}
              onFilterChange={handleFilterChange}
              activeTab={activeTab}
              isLoading={isLoading}
            />
          </div>
          
          <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 whitespace-nowrap min-w-fit lg:w-auto lg:ml-auto relative z-40">
            <SelectAllButton items={currentItems} />
            <AddEntityButton 
              entityType={activeTab}
              onEntityAdded={(newEntity) => {
                // Add the new entity to the appropriate state array
                if ('first_name' in newEntity) {
                  setAttendees([...attendees, newEntity as Attendee]);
                } else if ('start_date' in newEntity) {
                  setConferences([...conferences, newEntity as Conference]);
                } else {
                  setHealthSystems([...healthSystems, newEntity as HealthSystem]);
                }
              }}
              currentConferenceName={
                activeTab === 'conferences' && selectedItem 
                  ? (selectedItem as Conference).name 
                  : undefined
              }
            />
            <FilterMenu
              activeTab={activeTab}
              onFilterChange={handleFilterChange}
              isOpen={activeMenu === 'filter'}
              onToggle={() => handleMenuToggle('filter')}
            />
            
            <PropertiesMenu
              activeTab={activeTab}
              visibleColumns={visibleColumns[activeTab]}
              onColumnToggle={handleColumnToggle}
              onColumnOrderChange={setColumnOrder}
              view={view}
              isOpen={activeMenu === 'properties'}
              onToggle={() => handleMenuToggle('properties')}
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
            {renderCardView()}
          </div>
        )}
      </div>
    )
  }

  const handleMenuToggle = (menu: 'filter' | 'properties' | 'view-settings') => {
    // If clicking the same menu that's open, close it
    if (activeMenu === menu) {
      setActiveMenu(null)
    } else {
      // Otherwise, open the clicked menu and close any others
      setActiveMenu(menu)
    }
  }

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

  const handleListSelect = async (listId: string | null) => {
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
  }

  // Fetch lists function to be shared between components
  const fetchLists = async () => {
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
  }

  // Fetch lists when component mounts
  useEffect(() => {
    fetchLists()
  }, [])

  // Function to handle deleting a list
  const handleListDelete = async (listId: string) => {
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
  };

  // Handle AI enrichment completion
  const handleAIEnrichmentComplete = async (enrichedData: any) => {
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
  }

  // Replace the handleDefinitiveEnrichmentComplete function with a corrected version
  const handleDefinitiveEnrichmentComplete = async (enrichedData: any) => {
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
  };

  // Add the missing handleAttendeesDelete function
  const handleAttendeesDelete = async (attendeesToDelete: Attendee[]) => {
    if (!attendeesToDelete || attendeesToDelete.length === 0) return;
    
    const results: Array<{
      attendee: Attendee;
      success: boolean;
      error?: string;
    }> = [];
    
    // Process each attendee sequentially
    for (const attendee of attendeesToDelete) {
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
  };

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
            onTabChange={(tab) => {
              // Reset selectedItem when changing tabs
              setSelectedItem(null);
              setActiveTab(tab);
            }} 
            counts={{
              attendees: attendees.length,
              'health-systems': healthSystems.length,
              conferences: conferences.length
            }}
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
          onDelete={handleBulkDelete}
          conferenceName={
            activeListId && lists.find(list => list.id === activeListId)
              ? lists.find(list => list.id === activeListId)?.name
              : (activeTab === 'conferences' && selectedItem ? (selectedItem as Conference).name : '')
          }
          activeListId={activeListId}
          onListDelete={handleListDelete}
          refreshLists={fetchLists}
        />
      </main>
    </SelectionProvider>
  )
} 