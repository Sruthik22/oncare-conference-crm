'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { DataTable } from '@/components/DataTable'
import { SearchBar } from '@/components/SearchBar'
import { FilterMenu } from '@/components/FilterMenu'
import { ItemCard } from '@/components/ItemCard'
import { AttendeeDetail } from '@/components/AttendeeDetail'
import { ConferenceDetail } from '@/components/ConferenceDetail'
import { HealthSystemDetail } from '@/components/HealthSystemDetail'
import { supabase } from '@/lib/supabase'
import type { Attendee, HealthSystem, Conference } from '@/types'
import { ColumnDef } from '@tanstack/react-table'
import Image from 'next/image'
import { 
  UserIcon, 
  BuildingOfficeIcon, 
  CalendarIcon, 
  MapPinIcon,
  EnvelopeIcon,
  ArrowLeftIcon,
  AdjustmentsHorizontalIcon,
  PhoneIcon,
  BriefcaseIcon,
  GlobeAltIcon,
  ViewColumnsIcon,
  Bars3Icon,
} from '@heroicons/react/24/outline'
import { Icon } from '@/components/Icon'
import debounce from 'lodash/debounce'
import { createSwapy } from 'swapy'

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

type ColumnType = ColumnDef<Attendee> | ColumnDef<HealthSystem> | ColumnDef<Conference>;

export default function Home() {
  const [view, setView] = useState<'table' | 'cards'>('cards')
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [healthSystems, setHealthSystems] = useState<HealthSystem[]>([])
  const [conferences, setConferences] = useState<Conference[]>([])
  const [selectedItem, setSelectedItem] = useState<Attendee | HealthSystem | Conference | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'attendees' | 'health-systems' | 'conferences'>('attendees')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({
    titles: [],
    states: [],
    conferences: [],
  })
  const [visibleColumns, setVisibleColumns] = useState<Record<string, string[]>>({
    attendees: ['name', 'email', 'phone', 'title', 'company'],
    'health-systems': ['name', 'location', 'website'],
    conferences: ['name', 'date', 'location'],
  })
  const [searchQuery, setSearchQuery] = useState('');
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const swapyRef = useRef<ReturnType<typeof createSwapy> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [localSearchQuery, setLocalSearchQuery] = useState('');

  // Table columns with visibility control
  const attendeeColumns: ColumnDef<Attendee>[] = [
    {
      id: 'name',
      header: 'Name',
      accessorFn: (row) => `${row.first_name} ${row.last_name}`,
    },
    { id: 'email', header: 'Email', accessorKey: 'email' },
    { id: 'phone', header: 'Phone', accessorKey: 'phone' },
    { id: 'title', header: 'Title', accessorKey: 'title' },
    { id: 'company', header: 'Company', accessorKey: 'company' },
  ]

  const healthSystemColumns: ColumnDef<HealthSystem>[] = [
    { id: 'name', header: 'Name', accessorKey: 'name' },
    { id: 'location', header: 'Location', accessorFn: (row) => `${row.city || ''}, ${row.state || ''}` },
    { id: 'website', header: 'Website', accessorKey: 'website' },
  ]

  const conferenceColumns: ColumnDef<Conference>[] = [
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
  ]

  // Get all available columns for current tab
  const getAllColumns = useMemo(() => {
    switch (activeTab) {
      case 'attendees':
        return attendeeColumns
      case 'health-systems':
        return healthSystemColumns
      case 'conferences':
        return conferenceColumns
      default:
        return []
    }
  }, [activeTab]);

  // Memoize the debounced search function
  const debouncedSetSearch = useMemo(
    () => debounce((value: string) => {
      setSearchQuery(value);
    }, 300),
    []
  );

  // Memoize the base columns
  const baseColumns = useMemo(() => getAllColumns, [getAllColumns]);

  // Memoize ordered columns before filtering
  const orderedColumns = useMemo(() => {
    if (columnOrder.length === 0) return baseColumns;
    return columnOrder
      .map(id => baseColumns.find(col => col.id === id))
      .filter((col): col is ColumnType => Boolean(col));
  }, [baseColumns, columnOrder]);

  // Memoize filtered columns
  const filteredColumns = useMemo(() => {
    if (!searchQuery) return orderedColumns;
    
    const lowerQuery = searchQuery.toLowerCase();
    return orderedColumns.filter((column): column is ColumnType => {
      if (!column || !column.header) return false;
      const headerStr = String(column.header).toLowerCase();
      return headerStr.includes(lowerQuery) && column.id !== 'name';
    });
  }, [orderedColumns, searchQuery]);

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

  // Filter options
  const titleOptions = useMemo(() => {
    const titles = Array.from(new Set(attendees.map(a => a.title).filter(Boolean)))
    return titles.map(title => ({ id: title as string, name: title as string }))
  }, [attendees])

  // Filtered data
  const filteredAttendees = useMemo(() => {
    return attendees.filter(attendee => {
      const searchMatch = !searchTerm || 
        `${attendee.first_name} ${attendee.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (attendee.email && attendee.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (attendee.company && attendee.company.toLowerCase().includes(searchTerm.toLowerCase()))
      
      const titleMatch = selectedFilters.titles.length === 0 || 
        (attendee.title && selectedFilters.titles.includes(attendee.title))
      
      // Add more filters as needed
      
      return searchMatch && titleMatch
    })
  }, [attendees, searchTerm, selectedFilters])

  const filteredHealthSystems = useMemo(() => {
    return healthSystems.filter(hs => {
      const searchMatch = !searchTerm || 
        hs.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (hs.city && hs.city.toLowerCase().includes(searchTerm.toLowerCase()))
      
      const stateMatch = selectedFilters.states.length === 0 || 
        (hs.state && selectedFilters.states.includes(hs.state))
      
      return searchMatch && stateMatch
    })
  }, [healthSystems, searchTerm, selectedFilters])

  const filteredConferences = useMemo(() => {
    return conferences.filter(conference => {
      const searchMatch = !searchTerm || 
        conference.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (conference.location && conference.location.toLowerCase().includes(searchTerm.toLowerCase()))
      
      return searchMatch
    })
  }, [conferences, searchTerm])

  // Get visible columns for current tab
  const getVisibleColumns = () => {
    const currentVisibleColumns = visibleColumns[activeTab];
    // Always include the name column if it exists
    const nameColumn = getAllColumns.find((col: ColumnType) => col.id === 'name');
    const visibleColumnsWithName = nameColumn 
      ? [nameColumn, ...getAllColumns.filter((col: ColumnType) => col.id !== 'name' && currentVisibleColumns.includes(col.id as string))]
      : getAllColumns.filter((col: ColumnType) => currentVisibleColumns.includes(col.id as string));

    switch (activeTab) {
      case 'attendees':
        return visibleColumnsWithName as ColumnDef<Attendee>[];
      case 'health-systems':
        return visibleColumnsWithName as ColumnDef<HealthSystem>[];
      case 'conferences':
        return visibleColumnsWithName as ColumnDef<Conference>[];
      default:
        return [];
    }
  }

  // Handle column visibility toggle
  const handleColumnToggle = (columnId: string) => {
    if (columnId === 'name') return; // Prevent toggling the name column
    
    setVisibleColumns(prev => ({
      ...prev,
      [activeTab]: prev[activeTab].includes(columnId)
        ? prev[activeTab].filter(id => id !== columnId)
        : [...prev[activeTab], columnId]
    }))
  }

  const handleSearch = (term: string) => {
    setSearchTerm(term)
  }

  const handleFilterChange = (filterType: keyof typeof selectedFilters, values: string[]) => {
    setSelectedFilters(prev => ({
      ...prev,
      [filterType]: values
    }))
  }

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
    const getVisibleFields = (item: Attendee | HealthSystem | Conference) => {
      const fields: { label: string; value: string; icon: React.ReactNode }[] = [];
      const visibleColumnIds = visibleColumns[activeTab];

      columnOrder.forEach(id => {
        if (id === 'name') return; // Skip name field
        if (!visibleColumnIds.includes(id)) return;

        const column = getAllColumns.find((col: ColumnType) => col.id === id);
        if (!column) return;

        let value = '';
        if ('accessorKey' in column && column.accessorKey) {
          const key = column.accessorKey as keyof (Attendee | HealthSystem | Conference);
          value = String(item[key] || '');
        } else if ('accessorFn' in column) {
          // Type guard for different item types
          if ('first_name' in item) {
            value = String((column as any).accessorFn(item as Attendee) || '');
          } else if ('start_date' in item) {
            value = String((column as any).accessorFn(item as Conference) || '');
          } else {
            value = String((column as any).accessorFn(item as HealthSystem) || '');
          }
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
              title="Title"
              options={titleOptions}
              selectedValues={selectedFilters.titles}
              onChange={(values) => handleFilterChange('titles', values)}
            />
            
            <div className="relative">
              <button
                onClick={() => document.getElementById('column-menu')?.classList.toggle('hidden')}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
              >
                <Icon icon={AdjustmentsHorizontalIcon} size="xs" className="mr-2" />
                Properties
              </button>
              <div
                id="column-menu"
                className="hidden absolute right-0 mt-2 w-72 rounded-md bg-white border border-gray-200 shadow-lg z-50"
              >
                <div className="p-4">
                  <div className="relative mb-4">
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search for a property..."
                      value={localSearchQuery}
                      onChange={handleSearchChange}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    {renderPropertiesList()}
                  </div>
                </div>
              </div>
            </div>
            
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
          <div className="space-y-4 relative z-0">
            {renderCardView()}
          </div>
        )}
      </div>
    )
  }

  const getColumnIcon = (columnId: string) => {
    switch (columnId) {
      case 'name':
        return <Icon icon={UserIcon} size="sm" className="text-gray-400" />;
      case 'email':
        return <Icon icon={EnvelopeIcon} size="sm" className="text-gray-400" />;
      case 'phone':
        return <Icon icon={PhoneIcon} size="sm" className="text-gray-400" />;
      case 'title':
        return <Icon icon={BriefcaseIcon} size="sm" className="text-gray-400" />;
      case 'company':
        return <Icon icon={BuildingOfficeIcon} size="sm" className="text-gray-400" />;
      case 'location':
        return <Icon icon={MapPinIcon} size="sm" className="text-gray-400" />;
      case 'website':
        return <Icon icon={GlobeAltIcon} size="sm" className="text-gray-400" />;
      case 'date':
        return <Icon icon={CalendarIcon} size="sm" className="text-gray-400" />;
      default:
        return <Icon icon={ViewColumnsIcon} size="sm" className="text-gray-400" />;
    }
  };

  // Initialize column order
  useEffect(() => {
    const initialOrder = getAllColumns.map((col: ColumnType) => col.id as string);
    setColumnOrder(initialOrder);
  }, [activeTab, getAllColumns]);

  // Update the properties list rendering with drag handle and sections
  const renderPropertiesList = () => {
    const shownColumns = filteredColumns.filter(column => 
      column.id === 'name' || visibleColumns[activeTab].includes(String(column.id))
    );
    const hiddenColumns = filteredColumns.filter(column => 
      column.id !== 'name' && !visibleColumns[activeTab].includes(String(column.id))
    );

    const viewText = view === 'cards' ? 'Card' : 'Table';

    return (
      <div className="space-y-4">
        <div>
          <div className="text-sm font-medium text-gray-700 mb-2">
            Shown in {viewText}
          </div>
          <div id="shown-properties-list" className="space-y-1">
            {shownColumns.map((column) => {
              const isNameColumn = column.id === 'name';
              const icon = getColumnIcon(String(column.id));
              return (
                <div
                  key={String(column.id)}
                  data-swapy-slot={String(column.id)}
                  className="mb-1"
                >
                  <div
                    data-swapy-item={String(column.id)}
                    className={`flex items-center px-3 py-2 rounded-lg hover:bg-gray-50 ${isNameColumn ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center flex-1 min-w-0">
                      <div 
                        className="flex items-center justify-center w-6 h-6 mr-2 text-gray-400 cursor-grab"
                      >
                        <Icon icon={Bars3Icon} size="sm" />
                      </div>
                      <div className="flex items-center justify-center w-6 h-6 mr-3">
                        {icon}
                      </div>
                      <span className="text-sm text-gray-900 truncate">
                        {String(column.header)}
                      </span>
                    </div>
                    <div className="ml-3 flex items-center h-5">
                      <input
                        type="checkbox"
                        checked={true}
                        onChange={() => !isNameColumn && handleColumnToggle(String(column.id))}
                        disabled={isNameColumn}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {hiddenColumns.length > 0 && (
          <div>
            <div className="text-sm font-medium text-gray-700 mb-2">
              Not Shown in {viewText}
            </div>
            <div id="hidden-properties-list" className="space-y-1">
              {hiddenColumns.map((column) => {
                const icon = getColumnIcon(String(column.id));
                return (
                  <div
                    key={String(column.id)}
                    className="mb-1"
                  >
                    <div
                      className="flex items-center px-3 py-2 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center flex-1 min-w-0">
                        <div 
                          className="flex items-center justify-center w-6 h-6 mr-2 text-gray-400"
                        >
                          <Icon icon={Bars3Icon} size="sm" />
                        </div>
                        <div className="flex items-center justify-center w-6 h-6 mr-3">
                          {icon}
                        </div>
                        <span className="text-sm text-gray-900 truncate">
                          {String(column.header)}
                        </span>
                      </div>
                      <div className="ml-3 flex items-center h-5">
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={() => handleColumnToggle(String(column.id))}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Update Swapy initialization to use basic setup
  useEffect(() => {
    const container = document.querySelector('#shown-properties-list') as HTMLElement;
    if (!container) return;

    swapyRef.current = createSwapy(container);

    swapyRef.current.onSwap(() => {
      const newOrder = Array.from(container.querySelectorAll('[data-swapy-item]'))
        .map(item => item.getAttribute('data-swapy-item'))
        .filter((id): id is string => id !== null);
      setColumnOrder(newOrder);
    });

    return () => {
      if (swapyRef.current) {
        swapyRef.current.destroy();
      }
    };
  }, [activeTab, view]);

  // Handle search input change with local state
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearchQuery(value);
    debouncedSetSearch(value);
  };

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