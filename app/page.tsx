'use client'

import { useState, useEffect, useMemo } from 'react'
import { DataTable } from '@/components/DataTable'
import { CardView } from '@/components/CardView'
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
} from '@heroicons/react/24/outline'
import { Icon } from '@/components/Icon'

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

  const stateOptions = useMemo(() => {
    const states = Array.from(new Set(healthSystems.map(hs => hs.state).filter(Boolean)))
    return states.map(state => ({ id: state as string, name: state as string }))
  }, [healthSystems])

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

  // Table columns
  const attendeeColumns: ColumnDef<Attendee>[] = [
    {
      header: 'Name',
      accessorFn: (row) => `${row.first_name} ${row.last_name}`,
    },
    { header: 'Email', accessorKey: 'email' },
    { header: 'Phone', accessorKey: 'phone' },
    { header: 'Title', accessorKey: 'title' },
    { header: 'Company', accessorKey: 'company' },
  ]

  const healthSystemColumns: ColumnDef<HealthSystem>[] = [
    { header: 'Name', accessorKey: 'name' },
    { header: 'Location', accessorFn: (row) => `${row.city || ''}, ${row.state || ''}` },
    { header: 'Website', accessorKey: 'website' },
  ]

  const conferenceColumns: ColumnDef<Conference>[] = [
    { header: 'Name', accessorKey: 'name' },
    { 
      header: 'Date', 
      accessorFn: (row) => {
        if (!row.start_date) return ''
        const start = new Date(row.start_date).toLocaleDateString()
        const end = row.end_date ? new Date(row.end_date).toLocaleDateString() : null
        return end ? `${start} - ${end}` : start
      }
    },
    { header: 'Location', accessorKey: 'location' },
  ]

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
    switch (activeTab) {
      case 'attendees':
        return (
          <CardView
            items={filteredAttendees}
            renderCard={(attendee) => (
              <ItemCard
                title={`${attendee.first_name} ${attendee.last_name}`}
                subtitle={attendee.title}
                icon={<Icon icon={UserIcon} size="sm" className="text-primary-600" />}
                tags={[
                  ...(attendee.company ? [{ text: attendee.company, color: 'gray' as const }] : []),
                ]}
                onClick={() => setSelectedItem(attendee)}
              >
                {attendee.email && (
                  <p className="flex items-center mt-2 text-gray-500">
                    <Icon icon={EnvelopeIcon} size="xs" className="mr-2 text-gray-400" />
                    {attendee.email}
                  </p>
                )}
              </ItemCard>
            )}
          />
        )
      case 'health-systems':
        return (
          <CardView
            items={filteredHealthSystems}
            renderCard={(system) => (
              <ItemCard
                title={system.name}
                subtitle={[system.city, system.state].filter(Boolean).join(', ')}
                icon={<Icon icon={BuildingOfficeIcon} size="sm" className="text-accent-600" />}
                tags={system.state ? [{ text: system.state, color: 'accent' as const }] : []}
                onClick={() => setSelectedItem(system)}
              />
            )}
          />
        )
      case 'conferences':
        return (
          <CardView
            items={filteredConferences}
            renderCard={(conference) => (
              <ItemCard
                title={conference.name}
                subtitle={conference.location}
                icon={<Icon icon={CalendarIcon} size="sm" className="text-secondary-600" />}
                tags={[
                  {
                    text: conference.start_date 
                      ? new Date(conference.start_date).toLocaleDateString()
                      : 'No date',
                    color: 'secondary' as const
                  }
                ]}
                onClick={() => setSelectedItem(conference)}
              >
                {conference.location && (
                  <p className="flex items-center mt-2 text-gray-500">
                    <Icon icon={MapPinIcon} size="xs" className="mr-2 text-gray-400" />
                    {conference.location}
                  </p>
                )}
              </ItemCard>
            )}
          />
        )
    }
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
            <Icon icon={ArrowLeftIcon} size="xs" className="mr-1" />
            Back to list
          </button>
          
          {renderSelectedItemDetail()}
        </div>
      )
    }

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <SearchBar 
            placeholder={`Search ${activeTab}...`}
            onSearch={handleSearch}
          />
          
          <div className="flex flex-wrap gap-2">
            {activeTab === 'attendees' && (
              <FilterMenu
                title="Title"
                options={titleOptions}
                selectedValues={selectedFilters.titles}
                onChange={(values) => handleFilterChange('titles', values)}
              />
            )}
            
            {activeTab === 'health-systems' && (
              <FilterMenu
                title="State"
                options={stateOptions}
                selectedValues={selectedFilters.states}
                onChange={(values) => handleFilterChange('states', values)}
              />
            )}
            
            <div className="flex items-center space-x-2 ml-auto">
              <button
                onClick={() => setView('table')}
                className={`p-2 rounded-md ${
                  view === 'table'
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'
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
                    : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'
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
              { id: 'attendees', label: 'Attendees', count: filteredAttendees.length, icon: <Icon icon={UserIcon} size="xs" className="mr-1.5" /> },
              { id: 'health-systems', label: 'Health Systems', count: filteredHealthSystems.length, icon: <Icon icon={BuildingOfficeIcon} size="xs" className="mr-1.5" /> },
              { id: 'conferences', label: 'Conferences', count: filteredConferences.length, icon: <Icon icon={CalendarIcon} size="xs" className="mr-1.5" /> },
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
                {tab.icon}
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
              <DataTable
                data={filteredAttendees}
                columns={attendeeColumns}
                onRowClick={setSelectedItem}
              />
            )}
            
            {activeTab === 'health-systems' && (
              <DataTable
                data={filteredHealthSystems}
                columns={healthSystemColumns}
                onRowClick={setSelectedItem}
              />
            )}
            
            {activeTab === 'conferences' && (
              <DataTable
                data={filteredConferences}
                columns={conferenceColumns}
                onRowClick={setSelectedItem}
              />
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {renderCardView()}
          </div>
        )}
      </div>
    )
  }

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