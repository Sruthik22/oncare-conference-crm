'use client'

import { useState, useEffect, useMemo } from 'react'
import { DataTable } from '@/components/DataTable'
import { SearchBar } from '@/components/SearchBar'
import { FilterMenu } from '@/components/FilterMenu'
import { ItemCard } from '@/components/ItemCard'
import { AttendeeDetail } from '@/components/AttendeeDetail'
import { ConferenceDetail } from '@/components/ConferenceDetail'
import { HealthSystemDetail } from '@/components/HealthSystemDetail'
import { supabase } from '@/lib/supabase'
import type { Attendee, HealthSystem, Conference } from '@/types'
import { ColumnDef, CellContext } from '@tanstack/react-table'
import Image from 'next/image'
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
  Cog6ToothIcon,
} from '@heroicons/react/24/outline'
import { Icon } from '@/components/Icon'
import { PropertiesMenu } from '@/components/PropertiesMenu'

// Helper function to fetch all records using pagination
async function fetchAllRecords<T>(
  table: string, 
  query: string, 
  pageSize = 1000
): Promise<T[]> {
  let allData: T[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    
    const { data, error } = await supabase
      .from(table)
      .select(query, { count: 'exact' })
      .range(from, to);

    if (error) throw error;
    
    if (data && data.length > 0) {
      allData = [...allData, ...data as T[]];
      page++;
    }
    
    // If we got fewer records than requested, we've reached the end
    hasMore = data && data.length === pageSize;
  }

  return allData;
}

export default function Home() {
  const [view, setView] = useState<'table' | 'cards'>('cards')
  const [columnsPerRow, setColumnsPerRow] = useState(3)
  const [activeMenu, setActiveMenu] = useState<'filter' | 'properties' | 'view-settings' | null>(null)
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [healthSystems, setHealthSystems] = useState<HealthSystem[]>([])
  const [conferences, setConferences] = useState<Conference[]>([])
  const [selectedItem, setSelectedItem] = useState<Attendee | HealthSystem | Conference | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'attendees' | 'health-systems' | 'conferences'>('attendees')
  const [searchTerm, setSearchTerm] = useState('')
  const [activeFilters, setActiveFilters] = useState<Array<{
    id: string
    property: string
    operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'is_empty' | 'is_not_empty' | 'greater_than' | 'less_than'
    value: string
  }>>([])
  const [visibleColumns, setVisibleColumns] = useState<Record<string, string[]>>({
    attendees: ['name', 'email', 'phone', 'title', 'company'],
    'health-systems': ['name', 'location', 'website'],
    conferences: ['name', 'date', 'location'],
  })
  const [columnOrder, setColumnOrder] = useState<string[]>([]);

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
  ], []);

  const healthSystemColumns = useMemo<ColumnDef<HealthSystem>[]>(() => [
    { id: 'name', header: 'Name', accessorKey: 'name' },
    { id: 'location', header: 'Location', accessorFn: (row) => `${row.city || ''}, ${row.state || ''}` },
    { id: 'website', header: 'Website', accessorKey: 'website' },
  ], []);

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
  ], []);

  // Get all available columns for current tab
  const getAllColumns = useMemo(() => {
    switch (activeTab) {
      case 'attendees':
        return attendeeColumns.map(col => ({
          ...col,
          accessorFn: (row: Attendee | HealthSystem | Conference) => {
            if ('first_name' in row) {
              const attendee = row as Attendee;
              if (col.id === 'name') {
                return `${attendee.first_name} ${attendee.last_name}`;
              }
              return attendee[col.id as keyof Attendee];
            }
            return undefined;
          },
          cell: (info: CellContext<Attendee | HealthSystem | Conference, unknown>) => {
            const row = info.row.original;
            if ('first_name' in row) {
              return typeof col.cell === 'function' ? col.cell(info as CellContext<Attendee, unknown>) : info.getValue();
            }
            return null;
          }
        })) as ColumnDef<Attendee | HealthSystem | Conference>[];
      case 'health-systems':
        return healthSystemColumns.map(col => ({
          ...col,
          accessorFn: (row: Attendee | HealthSystem | Conference) => {
            if ('name' in row && !('first_name' in row)) {
              const healthSystem = row as HealthSystem;
              if (col.id === 'location') {
                return `${healthSystem.city || ''}, ${healthSystem.state || ''}`;
              }
              return healthSystem[col.id as keyof HealthSystem];
            }
            return undefined;
          },
          cell: (info: CellContext<Attendee | HealthSystem | Conference, unknown>) => {
            const row = info.row.original;
            if ('name' in row && !('first_name' in row)) {
              return typeof col.cell === 'function' ? col.cell(info as CellContext<HealthSystem, unknown>) : info.getValue();
            }
            return null;
          }
        })) as ColumnDef<Attendee | HealthSystem | Conference>[];
      case 'conferences':
        return conferenceColumns.map(col => ({
          ...col,
          accessorFn: (row: Attendee | HealthSystem | Conference) => {
            if ('start_date' in row) {
              const conference = row as Conference;
              if (col.id === 'date') {
                if (!conference.start_date) return '';
                const start = new Date(conference.start_date).toLocaleDateString();
                const end = conference.end_date ? new Date(conference.end_date).toLocaleDateString() : null;
                return end ? `${start} - ${end}` : start;
              }
              return conference[col.id as keyof Conference];
            }
            return undefined;
          },
          cell: (info: CellContext<Attendee | HealthSystem | Conference, unknown>) => {
            const row = info.row.original;
            if ('start_date' in row) {
              return typeof col.cell === 'function' ? col.cell(info as CellContext<Conference, unknown>) : info.getValue();
            }
            return null;
          }
        })) as ColumnDef<Attendee | HealthSystem | Conference>[];
      default:
        return [];
    }
  }, [activeTab, attendeeColumns, healthSystemColumns, conferenceColumns]);

  // Fetch data on mount
  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Fetch all attendees with health system info
      const attendeesQuery = `*, health_systems (id, name, definitive_id, website, address, city, state, zip)`;
      const attendeesData = await fetchAllRecords<Attendee>('attendees', attendeesQuery);
      
      // Fetch all conferences
      const conferencesData = await fetchAllRecords<Conference>('conferences', '*');
      
      // Fetch all health systems
      const healthSystemsData = await fetchAllRecords<HealthSystem>('health_systems', '*');

      // Update state with fetched data
      setAttendees(attendeesData);
      setConferences(conferencesData);
      setHealthSystems(healthSystemsData);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while fetching data')
      console.error('Error fetching data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Filtered data
  const filteredAttendees = useMemo(() => {
    return attendees.filter(attendee => {
      const searchMatch = !searchTerm || 
        `${attendee.first_name} ${attendee.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (attendee.email && attendee.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (attendee.company && attendee.company.toLowerCase().includes(searchTerm.toLowerCase()))
      
      const filterMatch = activeFilters.every(filter => {
        const value = filter.property === 'name' 
          ? `${attendee.first_name} ${attendee.last_name}`
          : attendee[filter.property as keyof Attendee]

        if (typeof value === 'undefined') return true

        switch (filter.operator) {
          case 'equals':
            return String(value).toLowerCase() === filter.value.toLowerCase()
          case 'contains':
            return String(value).toLowerCase().includes(filter.value.toLowerCase())
          case 'starts_with':
            return String(value).toLowerCase().startsWith(filter.value.toLowerCase())
          case 'ends_with':
            return String(value).toLowerCase().endsWith(filter.value.toLowerCase())
          case 'is_empty':
            return !value || String(value).trim() === ''
          case 'is_not_empty':
            return value && String(value).trim() !== ''
          case 'greater_than':
            return new Date(String(value)) > new Date(filter.value)
          case 'less_than':
            return new Date(String(value)) < new Date(filter.value)
          default:
            return true
        }
      })
      
      return searchMatch && filterMatch
    })
  }, [attendees, searchTerm, activeFilters])

  const filteredHealthSystems = useMemo(() => {
    return healthSystems.filter(hs => {
      const searchMatch = !searchTerm || 
        hs.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (hs.city && hs.city.toLowerCase().includes(searchTerm.toLowerCase()))
      
      const filterMatch = activeFilters.every(filter => {
        const value = hs[filter.property as keyof HealthSystem]

        if (typeof value === 'undefined') return true

        switch (filter.operator) {
          case 'equals':
            return String(value).toLowerCase() === filter.value.toLowerCase()
          case 'contains':
            return String(value).toLowerCase().includes(filter.value.toLowerCase())
          case 'starts_with':
            return String(value).toLowerCase().startsWith(filter.value.toLowerCase())
          case 'ends_with':
            return String(value).toLowerCase().endsWith(filter.value.toLowerCase())
          case 'is_empty':
            return !value || String(value).trim() === ''
          case 'is_not_empty':
            return value && String(value).trim() !== ''
          case 'greater_than':
            return new Date(String(value)) > new Date(filter.value)
          case 'less_than':
            return new Date(String(value)) < new Date(filter.value)
          default:
            return true
        }
      })
      
      return searchMatch && filterMatch
    })
  }, [healthSystems, searchTerm, activeFilters])

  const filteredConferences = useMemo(() => {
    return conferences.filter(conference => {
      const searchMatch = !searchTerm || 
        conference.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (conference.location && conference.location.toLowerCase().includes(searchTerm.toLowerCase()))
      
      const filterMatch = activeFilters.every(filter => {
        const value = conference[filter.property as keyof Conference]

        if (typeof value === 'undefined') return true

        switch (filter.operator) {
          case 'equals':
            return String(value).toLowerCase() === filter.value.toLowerCase()
          case 'contains':
            return String(value).toLowerCase().includes(filter.value.toLowerCase())
          case 'starts_with':
            return String(value).toLowerCase().startsWith(filter.value.toLowerCase())
          case 'ends_with':
            return String(value).toLowerCase().endsWith(filter.value.toLowerCase())
          case 'is_empty':
            return !value || String(value).trim() === ''
          case 'is_not_empty':
            return value && String(value).trim() !== ''
          case 'greater_than':
            return new Date(String(value)) > new Date(filter.value)
          case 'less_than':
            return new Date(String(value)) < new Date(filter.value)
          default:
            return true
        }
      })
      
      return searchMatch && filterMatch
    })
  }, [conferences, searchTerm, activeFilters])

  // Get visible columns for current tab
  const getVisibleColumns = () => {
    const currentVisibleColumns = visibleColumns[activeTab];
    // Always include the name column if it exists
    const nameColumn = getAllColumns.find((col) => col.id === 'name');
    return nameColumn 
      ? [nameColumn, ...getAllColumns.filter((col) => col.id !== 'name' && currentVisibleColumns.includes(col.id as string))]
      : getAllColumns.filter((col) => currentVisibleColumns.includes(col.id as string));
  }

  // Handle column visibility toggle
  const handleColumnToggle = (columnId: string) => {
    if (columnId === 'name') return; // Prevent toggling the name column
    
    setVisibleColumns(prev => {
      const newVisibleColumns = prev[activeTab].includes(columnId)
        ? prev[activeTab].filter(id => id !== columnId)
        : [...prev[activeTab], columnId];
      
      // Update columnOrder to match the new visible columns
      setColumnOrder(prevOrder => {
        if (prev[activeTab].includes(columnId)) {
          // If hiding a column, remove it from the order
          return prevOrder.filter(id => id !== columnId);
        } else {
          // If showing a column, add it to the end of the order
          return [...prevOrder, columnId];
        }
      });
      
      return {
        ...prev,
        [activeTab]: newVisibleColumns
      };
    });
  }

  const handleSearch = (term: string) => {
    setSearchTerm(term)
  }

  const handleFilterChange = (filters: Array<{
    id: string
    property: string
    operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'is_empty' | 'is_not_empty' | 'greater_than' | 'less_than'
    value: string
  }>) => {
    setActiveFilters(filters);
  };

  // Handle update from detail components
  const handleAttendeeUpdate = (updatedAttendee: Attendee) => {
    setAttendees(prev => 
      prev.map(a => a.id === updatedAttendee.id ? updatedAttendee : a)
    );
    setSelectedItem(updatedAttendee);
  };

  const handleConferenceUpdate = (updatedConference: Conference) => {
    setConferences(prev => 
      prev.map(c => c.id === updatedConference.id ? updatedConference : c)
    );
    setSelectedItem(updatedConference);
  };

  const handleHealthSystemUpdate = (updatedHealthSystem: HealthSystem) => {
    setHealthSystems(prev => 
      prev.map(hs => hs.id === updatedHealthSystem.id ? updatedHealthSystem : hs)
    );
    setSelectedItem(updatedHealthSystem);
  };

  const renderSelectedItemDetail = () => {
    if (!selectedItem) return null

    if ('first_name' in selectedItem) {
      // Attendee detail view
      return <AttendeeDetail attendee={selectedItem} onUpdate={handleAttendeeUpdate} />
    } else if ('start_date' in selectedItem) {
      // Conference detail view
      return <ConferenceDetail conference={selectedItem} onUpdate={handleConferenceUpdate} />
    } else {
      // Health System detail view
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
    };

    const getVisibleFields = (item: Attendee | HealthSystem | Conference) => {
      const fields: { label: string; value: string; icon: React.ReactNode }[] = [];
      const visibleColumnIds = visibleColumns[activeTab];

      columnOrder.forEach(id => {
        if (id === 'name') return; // Skip name field
        if (!visibleColumnIds.includes(id)) return;

        const column = getAllColumns.find((col) => col.id === id);
        if (!column) return;

        let value = '';
        if ('accessorKey' in column && column.accessorKey) {
          const key = column.accessorKey as keyof (Attendee | HealthSystem | Conference);
          value = String(item[key] || '');
        } else if ('accessorFn' in column && typeof column.accessorFn === 'function') {
          value = String(column.accessorFn(item, 0) || '');
        }

        fields.push({
          label: String(column.header),
          value: value,
          icon: getColumnIcon(String(column.id))
        });
      });

      return fields;
    };

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
      ));
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
      ));
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
      ));
    }

    return null;
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
            placeholder={`Search ${activeTab}...`}
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
              <button
                onClick={() => setView('table')}
                className={`p-2 rounded-md ${
                  view === 'table'
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-300'
                } transition-colors`}
                aria-label="Table view"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18M3 18h18M3 6h18" />
                </svg>
              </button>
              
              <button
                onClick={() => setView('cards')}
                className={`p-2 rounded-md ${
                  view === 'cards'
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-300'
                } transition-colors`}
                aria-label="Card view"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>

              {view === 'cards' && (
                <div className="relative">
                  <button
                    onClick={() => handleMenuToggle('view-settings')}
                    className="p-2 rounded-md bg-white text-gray-500 hover:bg-gray-50 border border-gray-300 transition-colors flex items-center justify-center menu-button"
                    aria-label="View settings"
                  >
                    <Icon icon={Cog6ToothIcon} size="sm" />
                  </button>
                  {activeMenu === 'view-settings' && (
                    <div className="absolute right-0 mt-2 w-48 rounded-md bg-white border border-gray-200 shadow-lg z-50 menu-content">
                      <div className="p-4">
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                              <Icon icon={ViewColumnsIcon} size="sm" className="mr-2 text-gray-400" />
                              Columns per row
                            </label>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => setColumnsPerRow(Math.max(1, columnsPerRow - 1))}
                                disabled={columnsPerRow <= 1}
                                className={`p-1 rounded-md ${
                                  columnsPerRow <= 1
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                              >
                                -
                              </button>
                              <span className="text-sm text-gray-900">{columnsPerRow}</span>
                              <button
                                onClick={() => setColumnsPerRow(Math.min(4, columnsPerRow + 1))}
                                disabled={columnsPerRow >= 4}
                                className={`p-1 rounded-md ${
                                  columnsPerRow >= 4
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'attendees', label: 'Attendees', count: filteredAttendees.length },
              { id: 'health-systems', label: 'Health Systems', count: filteredHealthSystems.length },
              { id: 'conferences', label: 'Conferences', count: filteredConferences.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`
                  whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center
                  ${
                    activeTab === tab.id
                      ? 'border-primary-600 text-primary-700'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } transition-colors
                `}
              >
                {tab.id === 'attendees' && <Icon icon={UserIcon} size="xs" className="mr-1.5 text-gray-400" />}
                {tab.id === 'health-systems' && <Icon icon={BuildingOfficeIcon} size="xs" className="mr-1.5 text-gray-400" />}
                {tab.id === 'conferences' && <Icon icon={CalendarIcon} size="xs" className="mr-1.5 text-gray-400" />}
                {tab.label}
                <span className={`
                  ml-1.5 py-0.5 px-2 rounded-full text-xs font-medium
                  ${activeTab === tab.id ? 'bg-primary-100 text-primary-800' : 'bg-gray-100 text-gray-600'}
                `}>
                  {tab.count}
                </span>
              </button>
            ))}
          </nav>
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

  // Initialize columnOrder when view changes
  useEffect(() => {
    if (view === 'cards') {
      setColumnOrder(visibleColumns[activeTab]);
    }
  }, [view, activeTab, visibleColumns]);

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
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <Image 
                src="/oncare_logo.svg" 
                alt="OnCare Logo" 
                width={32}
                height={32}
                className="h-8 w-auto"
                priority
              />
              <h1 className="text-xl font-bold text-gray-900">Oncare CRM</h1>
            </div>
          </div>
        </div>
      </header>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderContent()}
      </div>
    </main>
  )
} 