'use client'

import { useState, useEffect, useMemo } from 'react'
import { DataTable } from '@/components/DataTable'
import { SearchBar } from '@/components/SearchBar'
import { FilterMenu } from '@/components/FilterMenu'
import { ItemCard } from '@/components/ItemCard'
import { AttendeeDetail } from '@/components/AttendeeDetail'
import { ConferenceDetail } from '@/components/ConferenceDetail'
import { HealthSystemDetail } from '@/components/HealthSystemDetail'
import { ViewSettingsMenu } from '@/components/ViewSettingsMenu'
import { ViewToggle } from '@/components/ViewToggle'
import { TabNavigation } from '@/components/TabNavigation'
import { PropertiesMenu } from '@/components/PropertiesMenu'
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

  // Memoize column definitions
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
  ], [])

  const healthSystemColumns = useMemo<ColumnDef<HealthSystem>[]>(() => [
    { id: 'name', header: 'Name', accessorKey: 'name' },
    { id: 'location', header: 'Location', accessorFn: (row) => `${row.city || ''}, ${row.state || ''}` },
    { id: 'website', header: 'Website', accessorKey: 'website' },
  ], [])

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
  ], [])

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
    data: attendees,
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

  // Handle update from detail components
  const handleAttendeeUpdate = async (updatedAttendee: Attendee) => {
    const { error } = await supabase
      .from('attendees')
      .update(updatedAttendee)
      .eq('id', updatedAttendee.id)

    if (error) {
      console.error('Error updating attendee:', error)
      return
    }

    setAttendees(prev => prev.map(a => a.id === updatedAttendee.id ? updatedAttendee : a))
    setSelectedItem(updatedAttendee)
  }

  const handleConferenceUpdate = async (updatedConference: Conference) => {
    const { error } = await supabase
      .from('conferences')
      .update(updatedConference)
      .eq('id', updatedConference.id)

    if (error) {
      console.error('Error updating conference:', error)
      return
    }

    setConferences(prev => prev.map(c => c.id === updatedConference.id ? updatedConference : c))
    setSelectedItem(updatedConference)
  }

  const handleHealthSystemUpdate = async (updatedHealthSystem: HealthSystem) => {
    const { error } = await supabase
      .from('health_systems')
      .update(updatedHealthSystem)
      .eq('id', updatedHealthSystem.id)

    if (error) {
      console.error('Error updating health system:', error)
      return
    }

    setHealthSystems(prev => prev.map(h => h.id === updatedHealthSystem.id ? updatedHealthSystem : h))
    setSelectedItem(updatedHealthSystem)
  }

  const renderSelectedItemDetail = () => {
    if (!selectedItem) return null

    if ('first_name' in selectedItem) {
      return <AttendeeDetail attendee={selectedItem} onUpdate={handleAttendeeUpdate} />
    } else if ('start_date' in selectedItem) {
      return <ConferenceDetail conference={selectedItem} onUpdate={handleConferenceUpdate} />
    } else {
      return <HealthSystemDetail healthSystem={selectedItem} onUpdate={handleHealthSystemUpdate} />
    }
  }

  const renderCardView = () => {
    const getColumnIcon = (columnId: string) => {
      switch (columnId) {
        case 'name':
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
          return <Icon icon={MapPinIcon} size="sm" className="text-gray-400" />
        case 'website':
          return <Icon icon={GlobeAltIcon} size="sm" className="text-gray-400" />
        case 'date':
          return <Icon icon={CalendarIcon} size="sm" className="text-gray-400" />
        default:
          return <Icon icon={ViewColumnsIcon} size="sm" className="text-gray-400" />
      }
    }

    const getVisibleFields = (item: Attendee | HealthSystem | Conference) => {
      const fields: { label: string; value: string; icon: React.ReactNode }[] = []
      const visibleColumnIds = visibleColumns[activeTab]

      columnOrder.forEach(id => {
        if (id === 'name') return // Skip name field
        if (!visibleColumnIds.includes(id)) return

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
          icon={<Icon icon={UserIcon} size="sm" className="text-gray-400" />}
          onClick={() => setSelectedItem(attendee)}
        >
          <div className="space-y-2">
            {getVisibleFields(attendee).map((field, index) => (
              <div key={index} className="flex items-start">
                <div className="flex items-center min-w-[100px] text-gray-500">
                  <div className="w-5 h-5 mr-2">
                    {field.icon}
                  </div>
                  <span>{field.label}:</span>
                </div>
                <span className="text-gray-900 ml-2">{field.value}</span>
              </div>
            ))}
          </div>
        </ItemCard>
      ))
    }

    if (activeTab === 'health-systems') {
      return filteredHealthSystems.map((healthSystem) => (
        <ItemCard
          key={healthSystem.id}
          title={healthSystem.name}
          subtitle={`${healthSystem.city}, ${healthSystem.state}`}
          icon={<Icon icon={BuildingOfficeIcon} size="sm" className="text-gray-400" />}
          onClick={() => setSelectedItem(healthSystem)}
        >
          <div className="space-y-2">
            {getVisibleFields(healthSystem).map((field, index) => (
              <div key={index} className="flex items-start">
                <div className="flex items-center min-w-[100px] text-gray-500">
                  <div className="w-5 h-5 mr-2">
                    {field.icon}
                  </div>
                  <span>{field.label}:</span>
                </div>
                <span className="text-gray-900 ml-2">{field.value}</span>
              </div>
            ))}
          </div>
        </ItemCard>
      ))
    }

    if (activeTab === 'conferences') {
      return filteredConferences.map((conference) => (
        <ItemCard
          key={conference.id}
          title={conference.name}
          subtitle={conference.location}
          icon={<Icon icon={CalendarIcon} size="sm" className="text-gray-400" />}
          onClick={() => setSelectedItem(conference)}
        >
          <div className="space-y-2">
            {getVisibleFields(conference).map((field, index) => (
              <div key={index} className="flex items-start">
                <div className="flex items-center min-w-[100px] text-gray-500">
                  <div className="w-5 h-5 mr-2">
                    {field.icon}
                  </div>
                  <span>{field.label}:</span>
                </div>
                <span className="text-gray-900 ml-2">{field.value}</span>
              </div>
            ))}
          </div>
        </ItemCard>
      ))
    }

    return null
  }

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent"></div>
        </div>
      )
    }

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

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 relative z-40">
          <SearchBar 
            placeholder={`Search ${activeTab === 'health-systems' ? 'Health Systems' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}...`}
            onSearch={handleSearch}
          />
          
          <div className="flex items-center gap-4 relative z-40">
            <FilterMenu
              columns={getAllColumns.map(col => ({
                id: String(col.id),
                header: String(col.header)
              }))}
              onFilterChange={handleFilterChange}
              isOpen={activeMenu === 'filter'}
              onToggle={() => handleMenuToggle('filter')}
            />
            
            <PropertiesMenu
              columns={getAllColumns}
              visibleColumns={visibleColumns[activeTab]}
              onColumnToggle={handleColumnToggle}
              onColumnOrderChange={setColumnOrder}
              view={view}
              isOpen={activeMenu === 'properties'}
              onToggle={() => handleMenuToggle('properties')}
            />
            
            <div className="flex items-center space-x-2 relative z-40">
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
            'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
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

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="flex h-screen">
        <TabNavigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
          counts={{
            attendees: filteredAttendees.length,
            'health-systems': filteredHealthSystems.length,
            conferences: filteredConferences.length,
          }}
        />
        
        <div className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
            {renderContent()}
          </div>
        </div>
      </div>
    </main>
  )
} 