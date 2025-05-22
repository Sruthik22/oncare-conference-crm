import { useState, useEffect, useRef } from 'react'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface SearchBarProps {
  placeholder?: string
  onSearch: (searchTerm: string) => void
  onFilterChange?: (filters: any[]) => void
  activeTab?: 'attendees' | 'health-systems' | 'conferences'
  isLoading?: boolean
}

export function SearchBar({ 
  placeholder = 'Search...', 
  onSearch,
  activeTab, 
  isLoading = false 
}: SearchBarProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Handle search with debounce
  const handleSearch = (term: string) => {
    setSearchTerm(term)
    
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    // Set new timeout for debounced search
    timeoutRef.current = setTimeout(() => {
      onSearch(term)
    }, 400)
  }
  
  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])
  
  // Clear search when tab changes
  useEffect(() => {
    setSearchTerm('')
    onSearch('')
  }, [activeTab, onSearch])

  return (
    <div className="relative w-full">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
      </div>
      <input
        type="text"
        className="block w-full pl-10 pr-10 py-2.5 text-sm bg-white border border-gray-200 
                  rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 
                  focus:border-primary-500 transition-all duration-200"
        placeholder={placeholder}
        value={searchTerm}
        onChange={(e) => handleSearch(e.target.value)}
        disabled={isLoading}
      />
      {searchTerm && (
        <button
          type="button"
          className="absolute inset-y-0 right-0 pr-3 flex items-center"
          onClick={() => handleSearch('')}
          disabled={isLoading}
        >
          <XMarkIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
        </button>
      )}
    </div>
  )
} 