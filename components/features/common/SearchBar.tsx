import { useState, useEffect } from 'react'
import { MagnifyingGlassIcon, XMarkIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { Icon } from '@/components/ui/Icon'
import { ChatInterface } from '@/components/features/chat/ChatInterface'

interface SearchBarProps {
  placeholder?: string
  onSearch: (searchTerm: string) => void
  onFilterChange?: (filters: Array<{
    id: string
    property: string
    operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'is_empty' | 'is_not_empty' | 'greater_than' | 'less_than'
    value: string
  }>) => void
  activeTab: 'attendees' | 'health-systems' | 'conferences'
  isLoading: boolean
}

export function SearchBar({ 
  placeholder = 'Search...', 
  onSearch, 
  onFilterChange,
  activeTab,
  isLoading
}: SearchBarProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isAIMode, setIsAIMode] = useState(false)

  useEffect(() => {
    // Only trigger regular search when not in AI mode
    if (!isAIMode) {
      const delayDebounceFn = setTimeout(() => {
        onSearch(searchTerm)
      }, 300)
      return () => clearTimeout(delayDebounceFn)
    }
    return undefined // Explicit return for when isAIMode is true
  }, [searchTerm, onSearch, isAIMode])

  const handleFilterChange = (filters: Array<{
    id: string
    property: string
    operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'is_empty' | 'is_not_empty' | 'greater_than' | 'less_than'
    value: string
  }>) => {
    if (onFilterChange) {
      onFilterChange(filters)
    }
  }

  return (
    <div className="w-full max-w-2xl">
      <div className="flex">
        <div className="inline-flex shadow-sm rounded-md mb-1.5">
          <button
            onClick={() => setIsAIMode(false)}
            className={`px-3 py-1.5 text-xs rounded-l-md border border-r-0 ${
              !isAIMode 
                ? 'bg-white text-gray-800 border-gray-200 font-medium shadow-sm' 
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200'
            }`}
            aria-current={!isAIMode ? 'page' : undefined}
          >
            <div className="flex items-center">
              <Icon icon={MagnifyingGlassIcon} size="xs" className="mr-1" />
              <span>Regular Search</span>
            </div>
          </button>
          
          <button
            onClick={() => setIsAIMode(true)}
            className={`px-3 py-1.5 text-xs rounded-r-md border ${
              isAIMode 
                ? 'bg-white text-gray-800 border-gray-200 font-medium shadow-sm' 
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200'
            }`}
            aria-current={isAIMode ? 'page' : undefined}
          >
            <div className="flex items-center">
              <Icon icon={SparklesIcon} size="xs" className="mr-1" />
              <span>AI Query</span>
            </div>
          </button>
        </div>
      </div>

      {isAIMode ? (
        <ChatInterface 
          onSearch={handleFilterChange} 
          activeTab={activeTab} 
          isLoading={isLoading} 
          isInSearchBar={true} 
        />
      ) : (
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Icon icon={MagnifyingGlassIcon} size="sm" className="text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-10 py-2.5 text-sm bg-white border border-gray-200 
                      rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 
                      focus:border-primary-500 transition-all duration-200"
            placeholder={placeholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
              onClick={() => {
                setSearchTerm('')
                onSearch('')
              }}
            >
              <Icon icon={XMarkIcon} size="sm" className="text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>
      )}
    </div>
  )
} 