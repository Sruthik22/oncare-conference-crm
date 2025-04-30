import { useState, useEffect } from 'react'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { Icon } from '@/components/Icon'

interface SearchBarProps {
  placeholder?: string
  onSearch: (searchTerm: string) => void
}

export function SearchBar({ placeholder = 'Search...', onSearch }: SearchBarProps) {
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      onSearch(searchTerm)
    }, 300)
    return () => clearTimeout(delayDebounceFn)
  }, [searchTerm, onSearch])

  return (
    <div className="w-full max-w-md">
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
    </div>
  )
} 