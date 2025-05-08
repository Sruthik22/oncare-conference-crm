import { Icon } from '@/components/Icon'
import { UserIcon, BuildingOfficeIcon, CalendarIcon, TagIcon, ChevronDownIcon, ChevronRightIcon, MagnifyingGlassIcon, TrashIcon, PencilIcon, CheckIcon, XMarkIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

interface Tab {
  id: 'attendees' | 'health-systems' | 'conferences'
  label: string
  count: number
  filteredCount?: number
  icon: typeof UserIcon
}

interface List {
  id: string
  name: string
  count: number
}

interface TabNavigationProps {
  activeTab: 'attendees' | 'health-systems' | 'conferences'
  onTabChange: (tab: 'attendees' | 'health-systems' | 'conferences') => void
  counts: {
    attendees: number
    'health-systems': number
    conferences: number
  }
  filteredCounts?: {
    attendees?: number
    'health-systems'?: number
    conferences?: number
  }
  activeListId?: string | null
  onListSelect?: (listId: string | null) => void
  refreshLists?: () => Promise<void>
  lists: List[]
}

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

export function TabNavigation({ 
  activeTab, 
  onTabChange, 
  counts, 
  filteredCounts,
  activeListId, 
  onListSelect, 
  refreshLists,
  lists 
}: TabNavigationProps) {
  const [filteredLists, setFilteredLists] = useState<List[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [listsExpanded, setListsExpanded] = useState(true)
  const [showSearch, setShowSearch] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [editingListId, setEditingListId] = useState<string | null>(null)
  const [newListName, setNewListName] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)
  const { user, signOut, isLoading: authLoading } = useAuth()
  
  const tabs: Tab[] = [
    { 
      id: 'attendees', 
      label: 'Attendees', 
      count: counts.attendees, 
      filteredCount: filteredCounts?.attendees,
      icon: UserIcon 
    },
    { 
      id: 'health-systems', 
      label: 'Health Systems', 
      count: counts['health-systems'], 
      filteredCount: filteredCounts?.['health-systems'],
      icon: BuildingOfficeIcon 
    },
    { 
      id: 'conferences', 
      label: 'Conferences', 
      count: counts.conferences, 
      filteredCount: filteredCounts?.conferences,
      icon: CalendarIcon 
    },
  ]

  // Update filtered lists when lists change or search term changes
  useEffect(() => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      setFilteredLists(lists.filter(list => 
        list.name.toLowerCase().includes(term)
      ));
    } else {
      setFilteredLists(lists);
    }
  }, [lists, searchTerm]);

  const handleListClick = (listId: string) => {
    // Switch to attendees tab if not already there
    if (activeTab !== 'attendees') {
      onTabChange('attendees')
    }

    // Call the onListSelect function to filter attendees
    if (onListSelect) {
      // If clicking on the active list, deselect it
      if (activeListId === listId) {
        onListSelect(null)
      } else {
        onListSelect(listId)
      }
    }
  }

  const handleListDelete = async (listId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the list click handler
    
    if (isDeleting || !confirm('Are you sure you want to delete this list? This action cannot be undone.')) {
      return;
    }
    
    setIsDeleting(true);
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
      
      // If the deleted list was active, clear the selection
      if (activeListId === listId && onListSelect) {
        onListSelect(null);
      }
      
      // Refresh the lists
      if (refreshLists) {
        await refreshLists();
      }
    } catch (err) {
      console.error('Failed to delete list:', err);
      alert('Failed to delete list: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleListRename = async (listId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the list click handler
    
    // Find the list and set the current name as the initial value
    const list = lists.find(list => list.id === listId);
    if (list) {
      setNewListName(list.name);
      setEditingListId(listId);
    }
  };

  const handleRenameCancel = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the list click handler
    setEditingListId(null);
    setNewListName('');
  };

  const handleRenameSave = async (listId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the list click handler
    
    if (isRenaming || !newListName.trim()) {
      return;
    }
    
    setIsRenaming(true);
    try {
      const { error } = await supabase
        .from('lists')
        .update({ name: newListName.trim() })
        .eq('id', listId);
      
      if (error) throw new Error(error.message);
      
      // Refresh the lists
      if (refreshLists) {
        await refreshLists();
      }
      
      // Reset the state
      setEditingListId(null);
      setNewListName('');
    } catch (err) {
      console.error('Failed to rename list:', err);
      alert('Failed to rename list: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsRenaming(false);
    }
  };

  const toggleListsExpanded = () => {
    setListsExpanded(!listsExpanded)
    if (listsExpanded) {
      setShowSearch(false)
      setSearchTerm('')
    }
  }

  const toggleSearchVisibility = () => {
    setShowSearch(!showSearch)
    if (!showSearch) {
      // If showing search, ensure lists are expanded
      setListsExpanded(true)
    } else {
      // If hiding search, clear the search term
      setSearchTerm('')
    }
  }

  return (
    <div className="w-72 shrink-0 flex flex-col overflow-y-auto border-r border-gray-200 bg-white">
      <div className="flex h-[72px] shrink-0 items-center px-6 border-b border-gray-200">
        <Image 
          src="/oncare_logo.svg" 
          alt="OnCare Logo" 
          width={24}
          height={24}
          className="h-6 w-auto"
          priority
        />
        <span className="ml-3 text-gray-900 font-semibold text-sm">Oncare CRM</span>
      </div>
      <nav className="flex flex-1 flex-col px-6 pt-4">
        <ul role="list" className="flex flex-1 flex-col gap-y-7">
          <li>
            <ul role="list" className="-mx-2 space-y-1">
              {tabs.map((tab) => (
                <li key={tab.id}>
                  <button
                    onClick={() => onTabChange(tab.id)}
                    className={classNames(
                      activeTab === tab.id
                        ? 'bg-gray-50 text-indigo-600'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-indigo-600',
                      'group flex w-full gap-x-3 rounded-md p-2 text-sm/6 font-semibold'
                    )}
                  >
                    <Icon 
                      icon={tab.icon} 
                      size="sm" 
                      className={classNames(
                        activeTab === tab.id 
                          ? 'text-indigo-600' 
                          : 'text-gray-400 group-hover:text-indigo-600',
                        'size-6 shrink-0'
                      )}
                    />
                    <span className="truncate">{tab.label}</span>
                    <span
                      aria-hidden="true"
                      className="ml-auto w-9 min-w-max rounded-full bg-white px-2.5 py-0.5 text-center text-xs/5 font-medium whitespace-nowrap text-gray-600 ring-1 ring-gray-200 ring-inset"
                    >
                      {tab.filteredCount !== undefined ? tab.filteredCount : tab.count}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </li>
          
          <li>
            <div className="-mx-2">
              <div className="flex w-full items-center gap-x-2 rounded-md p-2">
                <button
                  onClick={toggleListsExpanded}
                  className="flex items-center gap-x-3 text-sm/6 font-semibold text-gray-700 hover:text-indigo-600"
                >
                  {listsExpanded ? (
                    <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                  )}
                  <TagIcon className="h-5 w-5 text-gray-400" />
                  <span>Lists</span>
                </button>
                
                {listsExpanded && (
                  <button 
                    onClick={toggleSearchVisibility}
                    className={classNames(
                      "ml-auto p-1 rounded-md",
                      showSearch ? "bg-indigo-50 text-indigo-600" : "text-gray-400 hover:text-indigo-600"
                    )}
                  >
                    <MagnifyingGlassIcon className="h-4 w-4" />
                  </button>
                )}
              </div>

              {listsExpanded && (
                <div className="mt-1 pl-7 pr-2">
                  {showSearch && (
                    <div className="mb-2 relative">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none">
                        <MagnifyingGlassIcon className="h-3.5 w-3.5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search lists..."
                        className="w-full py-1.5 pl-8 pr-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  )}
                  
                  {filteredLists.length === 0 ? (
                    <div className="px-2 py-1 text-xs text-gray-500">
                      {searchTerm ? "No matching lists found" : "No lists found"}
                    </div>
                  ) : (
                    <ul className="space-y-1 max-h-60 overflow-y-auto">
                      {filteredLists.map((list) => (
                        <li key={list.id}>
                          <div className="flex items-center">
                            {editingListId === list.id ? (
                              // Edit mode
                              <div className="flex items-center w-full">
                                <input
                                  type="text"
                                  value={newListName}
                                  onChange={(e) => setNewListName(e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex-1 py-1 px-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                  autoFocus
                                />
                                <button
                                  onClick={(e) => handleRenameSave(list.id, e)}
                                  disabled={isRenaming}
                                  className="ml-1 p-1 text-gray-400 hover:text-green-500 rounded-md"
                                  title="Save"
                                >
                                  <CheckIcon className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={handleRenameCancel}
                                  className="ml-1 p-1 text-gray-400 hover:text-gray-700 rounded-md"
                                  title="Cancel"
                                >
                                  <XMarkIcon className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              // View mode
                              <>
                                <button
                                  onClick={() => handleListClick(list.id)}
                                  className={classNames(
                                    activeListId === list.id && activeTab === 'attendees'
                                      ? 'bg-gray-50 text-indigo-600'
                                      : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600',
                                    'group flex w-full items-center justify-between gap-x-3 rounded-md px-2 py-1.5 text-sm'
                                  )}
                                >
                                  <span className="truncate">{list.name}</span>
                                  <span className="ml-auto w-7 min-w-max rounded-full bg-white px-2 py-0.5 text-center text-xs/5 font-medium text-gray-600 ring-1 ring-gray-200 ring-inset">
                                    {list.count}
                                  </span>
                                </button>
                                <button
                                  onClick={(e) => handleListRename(list.id, e)}
                                  disabled={isRenaming}
                                  className="ml-1 p-1 text-gray-400 hover:text-indigo-600 rounded-md"
                                  title="Rename list"
                                >
                                  <PencilIcon className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={(e) => handleListDelete(list.id, e)}
                                  disabled={isDeleting}
                                  className="ml-1 p-1 text-gray-400 hover:text-red-500 rounded-md"
                                  title="Delete list"
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </li>
          
          {/* User profile section - now at the bottom with auto margin top */}
          {user && (
            <li className="px-2 mt-auto pb-6">
              <div className="h-px bg-gray-200 w-full mb-3"></div>
              <div className="flex items-center mb-2">
                <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-medium">
                  {user.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="ml-2 flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{user.email}</p>
                </div>
              </div>
              
              <button 
                onClick={() => signOut()}
                className="flex w-full items-center gap-x-3 rounded-md p-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-indigo-600"
                disabled={authLoading}
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5 text-gray-400" />
                {authLoading ? 'Signing out...' : 'Sign Out'}
              </button>
            </li>
          )}
        </ul>
      </nav>
    </div>
  )
} 