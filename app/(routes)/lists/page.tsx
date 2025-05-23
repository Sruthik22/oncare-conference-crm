'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { TabNavigation } from '@/components/layout/TabNavigation'
import { useDataFetching } from '@/hooks/useDataFetching'
import { SelectionProvider } from '@/lib/context/SelectionContext'
import { TagIcon, PlusIcon } from '@heroicons/react/24/outline'
import { SearchBar } from '@/components/features/common/SearchBar'
import { supabase } from '@/lib/supabase'

// Define List interface
interface List {
  id: string
  name: string
  count: number
  created_at: string
}

export default function ListsPage() {
  const router = useRouter()
  const { totalCount } = useDataFetching()
  
  // UI state
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [lists, setLists] = useState<List[]>([])
  const [filteredLists, setFilteredLists] = useState<List[]>([])
  const [isCreatingList, setIsCreatingList] = useState(false)
  const [newListName, setNewListName] = useState('')
  
  // Filtered counts with proper types for TabNavigation
  const counts = {
    attendees: totalCount.attendees,
    'health-systems': totalCount.healthSystems,
    conferences: totalCount.conferences
  }
  
  // Fetch lists
  const fetchLists = useCallback(async (): Promise<void> => {
    setIsLoading(true);
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
          count: list.attendee_lists ? list.attendee_lists.length : 0,
          created_at: list.created_at
        }));
        
        setLists(formattedLists);
        setFilteredLists(formattedLists);
      }
    } catch (error) {
      console.error('Error fetching lists:', error);
    } finally {
      setIsLoading(false);
    }
    
    return Promise.resolve();
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  // Filter lists when search term changes
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredLists(lists);
    } else {
      const normalizedTerm = searchTerm.toLowerCase().trim();
      setFilteredLists(
        lists.filter(list => list.name.toLowerCase().includes(normalizedTerm))
      );
    }
  }, [searchTerm, lists]);

  // List selection handler
  const handleListSelect = useCallback((listId: string | null) => {
    if (listId) {
      router.push(`/lists/${listId}`);
    }
  }, [router]);

  // Search handler
  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);

  // Tab change handler
  const handleTabChange = useCallback((tab: 'attendees' | 'health-systems' | 'conferences') => {
    router.push(`/${tab}`);
  }, [router]);

  // Create new list
  const handleCreateList = useCallback(async () => {
    if (!newListName.trim() || isCreatingList) return;
    
    setIsCreatingList(true);
    try {
      // Create a new list
      const { data, error } = await supabase
        .from('lists')
        .insert([{ name: newListName.trim() }])
        .select();
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        // Redirect to the new list page
        router.push(`/lists/${data[0].id}`);
      }
    } catch (error) {
      console.error('Error creating list:', error);
      alert('Failed to create list. Please try again.');
    } finally {
      setIsCreatingList(false);
      setNewListName('');
    }
  }, [newListName, isCreatingList, router]);

  // Format date string
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <SelectionProvider>
      <div className="flex h-screen">
        <TabNavigation
          activeTab="attendees"
          onTabChange={handleTabChange}
          counts={counts}
          activeListId={null}
          onListSelect={handleListSelect}
          refreshLists={fetchLists}
          lists={lists}
        />
        
        <div className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {/* Search and create row */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div className="w-full md:max-w-xs">
                <SearchBar 
                  placeholder="Search lists..."
                  onSearch={handleSearch}
                  activeTab="attendees"
                  isLoading={isLoading}
                />
              </div>
              
              <div className="flex items-center gap-2">
                <div className="w-full">
                  <input
                    type="text"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    placeholder="New list name"
                    className="flex-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateList();
                      }
                    }}
                  />
                </div>
                <button
                  onClick={handleCreateList}
                  disabled={isCreatingList || !newListName.trim()}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                  Create List
                </button>
              </div>
            </div>
            
            {/* Lists grid */}
            <div className="mt-4">
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent"></div>
                </div>
              ) : filteredLists.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
                  {searchTerm ? (
                    <p className="text-gray-500">No lists found matching &quot;{searchTerm}&quot;</p>
                  ) : (
                    <>
                      <TagIcon className="h-12 w-12 text-gray-400 mb-2" />
                      <p className="text-gray-500 mb-4">No lists available yet. Create your first list to get started.</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredLists.map((list) => (
                    <div
                      key={list.id}
                      onClick={() => handleListSelect(list.id)}
                      className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer"
                    >
                      <div className="flex items-start">
                        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
                          <TagIcon className="h-4 w-4" />
                        </div>
                        <div className="ml-3 flex-1 min-w-0">
                          <h3 className="text-sm font-medium text-gray-900 truncate">
                            {list.name}
                          </h3>
                          <div className="flex items-center text-xs text-gray-500 mt-1">
                            <span className="bg-gray-100 rounded-full px-2 py-0.5">
                              {list.count} {list.count === 1 ? 'attendee' : 'attendees'}
                            </span>
                            <span className="mx-2">•</span>
                            <span>Created {formatDate(list.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </SelectionProvider>
  )
} 