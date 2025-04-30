'use client'

import { useState, useEffect, useMemo } from 'react'
import { DataTable } from '@/components/DataTable'
import { CardView } from '@/components/CardView'
import { SearchBar } from '@/components/SearchBar'
import { FilterMenu } from '@/components/FilterMenu'
import { ItemCard } from '@/components/ItemCard'
import { supabase } from '@/lib/supabase'
import type { Attendee, HealthSystem, Conference } from '@/types'
import { ColumnDef } from '@tanstack/react-table'
import { 
  UserIcon, 
  BuildingOfficeIcon, 
  CalendarIcon, 
  PresentationChartBarIcon,
  MapPinIcon,
  EnvelopeIcon,
  PhoneIcon,
  LinkIcon,
  ArrowLeftIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline'
import { Icon } from '@/components/Icon'

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

      // Fetch attendees with their health system information
      const { data: attendeesData, error: attendeesError } = await supabase
        .from('attendees')
        .select(`
          *,
          health_systems (
            id,
            name,
            definitive_id,
            website,
            address,
            city,
            state,
            zip
          )
        `)

      // Fetch conferences
      const { data: conferencesData, error: conferencesError } = await supabase
        .from('conferences')
        .select('*')

      // Fetch health systems
      const { data: healthSystemsData, error: healthSystemsError } = await supabase
        .from('health_systems')
        .select('*')

      if (attendeesError) throw attendeesError
      if (conferencesError) throw conferencesError
      if (healthSystemsError) throw healthSystemsError

      if (attendeesData) setAttendees(attendeesData)
      if (conferencesData) setConferences(conferencesData)
      if (healthSystemsData) setHealthSystems(healthSystemsData)
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

  const conferenceOptions = useMemo(() => {
    return conferences.map(conf => ({ id: conf.id, name: conf.name }))
  }, [conferences])

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

  const renderSelectedItemDetail = () => {
    if (!selectedItem) return null

    if ('first_name' in selectedItem) {
      // Attendee detail view
      const attendee = selectedItem as Attendee;
      return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 animate-fade-in">
          <div className="flex items-start">
            <div className="flex-shrink-0 mr-4">
              <div className="bg-primary-100 p-3 rounded-full icon-container w-12 h-12">
                <Icon icon={UserIcon} size="md" className="text-primary-600" />
              </div>
            </div>
            <div className="flex-grow">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {attendee.first_name} {attendee.last_name}
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                {attendee.title && (
                  <div className="flex items-center space-x-2">
                    <Icon icon={UserCircleIcon} size="xs" className="text-gray-400" />
                    <span className="text-gray-700">{attendee.title}</span>
                  </div>
                )}
                
                {attendee.company && (
                  <div className="flex items-center space-x-2">
                    <Icon icon={BuildingOfficeIcon} size="xs" className="text-gray-400" />
                    <span className="text-gray-700">{attendee.company}</span>
                  </div>
                )}
                
                {attendee.email && (
                  <div className="flex items-center space-x-2">
                    <Icon icon={EnvelopeIcon} size="xs" className="text-gray-400" />
                    <a href={`mailto:${attendee.email}`} className="text-primary-600 hover:text-primary-800">
                      {attendee.email}
                    </a>
                  </div>
                )}
                
                {attendee.phone && (
                  <div className="flex items-center space-x-2">
                    <Icon icon={PhoneIcon} size="xs" className="text-gray-400" />
                    <a href={`tel:${attendee.phone}`} className="text-primary-600 hover:text-primary-800">
                      {attendee.phone}
                    </a>
                  </div>
                )}
                
                {attendee.linkedin_url && (
                  <div className="flex items-center space-x-2">
                    <Icon icon={LinkIcon} size="xs" className="text-gray-400" />
                    <a 
                      href={attendee.linkedin_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:text-primary-800"
                    >
                      LinkedIn Profile
                    </a>
                  </div>
                )}
              </div>
              
              {attendee.notes && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Notes</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-gray-600 whitespace-pre-line text-sm">{attendee.notes}</p>
                  </div>
                </div>
              )}
              
              {attendee.certifications && attendee.certifications.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Certifications</h3>
                  <div className="flex flex-wrap gap-2">
                    {attendee.certifications.map((cert, idx) => (
                      <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary-100 text-secondary-800">
                        {cert}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )
    } else if ('start_date' in selectedItem) {
      // Conference detail view
      const conference = selectedItem as Conference;
      return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 animate-fade-in">
          <div className="flex items-start">
            <div className="flex-shrink-0 mr-4">
              <div className="bg-secondary-100 p-3 rounded-full icon-container w-12 h-12">
                <Icon icon={CalendarIcon} size="md" className="text-secondary-600" />
              </div>
            </div>
            <div className="flex-grow">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {conference.name}
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                {conference.start_date && (
                  <div className="flex items-center space-x-2">
                    <Icon icon={CalendarIcon} size="xs" className="text-gray-400" />
                    <span className="text-gray-700">
                      {new Date(conference.start_date).toLocaleDateString()}
                      {conference.end_date && ` - ${new Date(conference.end_date).toLocaleDateString()}`}
                    </span>
                  </div>
                )}
                
                {conference.location && (
                  <div className="flex items-center space-x-2">
                    <Icon icon={MapPinIcon} size="xs" className="text-gray-400" />
                    <span className="text-gray-700">{conference.location}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )
    } else {
      // Health System detail view
      const healthSystem = selectedItem as HealthSystem;
      return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 animate-fade-in">
          <div className="flex items-start">
            <div className="flex-shrink-0 mr-4">
              <div className="bg-accent-100 p-3 rounded-full icon-container w-12 h-12">
                <Icon icon={BuildingOfficeIcon} size="md" className="text-accent-600" />
              </div>
            </div>
            <div className="flex-grow">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {healthSystem.name}
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                {(healthSystem.city || healthSystem.state) && (
                  <div className="flex items-center space-x-2">
                    <Icon icon={MapPinIcon} size="xs" className="text-gray-400" />
                    <span className="text-gray-700">
                      {[healthSystem.city, healthSystem.state].filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}
                
                {healthSystem.address && (
                  <div className="flex items-center space-x-2">
                    <Icon icon={BuildingOfficeIcon} size="xs" className="text-gray-400" />
                    <span className="text-gray-700">{healthSystem.address}</span>
                  </div>
                )}
                
                {healthSystem.website && (
                  <div className="flex items-center space-x-2">
                    <Icon icon={LinkIcon} size="xs" className="text-gray-400" />
                    <a 
                      href={healthSystem.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:text-primary-800"
                    >
                      Visit Website
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )
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
              <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-2 rounded-lg shadow-sm flex items-center justify-center w-8 h-8">
                <Icon icon={PresentationChartBarIcon} size="sm" className="text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">OnCare CRM</h1>
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