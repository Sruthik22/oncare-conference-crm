import { useState } from 'react'
import { Icon } from './Icon'
import { 
  FunnelIcon,
  XMarkIcon,
  PlusIcon,
  UserIcon,
  BuildingOfficeIcon,
  CalendarIcon,
  MapPinIcon,
  EnvelopeIcon,
  PhoneIcon,
  BriefcaseIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline'

type FilterOperator = 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'is_empty' | 'is_not_empty' | 'greater_than' | 'less_than'

interface Filter {
  id: string
  property: string
  operator: FilterOperator
  value: string
}

interface FilterMenuProps {
  columns: Array<{
    id: string
    header: string
  }>
  onFilterChange: (filters: Filter[]) => void
  isOpen: boolean
  onToggle: () => void
}

export function FilterMenu({ columns, onFilterChange, isOpen, onToggle }: FilterMenuProps) {
  const [filters, setFilters] = useState<Filter[]>([])
  const [activeFilter, setActiveFilter] = useState<Filter | null>(null)

  const addFilter = () => {
    const newFilter: Filter = {
      id: Math.random().toString(36).substr(2, 9),
      property: columns[0]?.id || '',
      operator: 'equals',
      value: ''
    }
    setFilters([...filters, newFilter])
    setActiveFilter(newFilter)
  }

  const removeFilter = (id: string) => {
    const newFilters = filters.filter(f => f.id !== id)
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const updateFilter = (id: string, updates: Partial<Filter>) => {
    const newFilters = filters.map(f => 
      f.id === id ? { ...f, ...updates } : f
    )
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const getOperatorOptions = (property: string) => {
    const column = columns.find(c => c.id === property)
    if (!column) return []

    // Text-based operators
    if (['name', 'email', 'title', 'company', 'location'].includes(property)) {
      return [
        { value: 'equals', label: 'Equals' },
        { value: 'contains', label: 'Contains' },
        { value: 'starts_with', label: 'Starts with' },
        { value: 'ends_with', label: 'Ends with' },
        { value: 'is_empty', label: 'Is empty' },
        { value: 'is_not_empty', label: 'Is not empty' },
      ]
    }

    // Date-based operators
    if (['date'].includes(property)) {
      return [
        { value: 'equals', label: 'Equals' },
        { value: 'greater_than', label: 'After' },
        { value: 'less_than', label: 'Before' },
        { value: 'is_empty', label: 'Is empty' },
        { value: 'is_not_empty', label: 'Is not empty' },
      ]
    }

    // Default operators
    return [
      { value: 'equals', label: 'Equals' },
      { value: 'is_empty', label: 'Is empty' },
      { value: 'is_not_empty', label: 'Is not empty' },
    ]
  }

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
        return <Icon icon={FunnelIcon} size="sm" className="text-gray-400" />
    }
  }

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none menu-button"
      >
        <Icon icon={FunnelIcon} size="xs" className="mr-2" />
        Filter
        {filters.length > 0 && (
          <span className="ml-2 w-5 h-5 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
            {filters.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 rounded-md bg-white border border-gray-200 shadow-lg z-50 menu-content">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-900">Filters</h3>
              <button
                onClick={onToggle}
                className="text-gray-400 hover:text-gray-500"
              >
                <Icon icon={XMarkIcon} size="sm" />
              </button>
            </div>

            <div className="space-y-3">
              {filters.map((filter) => (
                <div
                  key={filter.id}
                  className={`p-3 rounded-lg border ${
                    activeFilter?.id === filter.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="relative w-full">
                      <select
                        value={filter.property}
                        onChange={(e) => updateFilter(filter.id, { property: e.target.value })}
                        className="block w-full pl-10 pr-10 py-2 text-sm border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 appearance-none bg-white"
                      >
                        {columns.map((column) => (
                          <option key={column.id} value={column.id}>
                            {column.header}
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        {getColumnIcon(filter.property)}
                      </div>
                      <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFilter(filter.id)}
                      className="ml-2 text-gray-400 hover:text-gray-500"
                    >
                      <Icon icon={XMarkIcon} size="sm" />
                    </button>
                  </div>

                  <div className="flex flex-col space-y-2">
                    <div className="relative">
                      <select
                        value={filter.operator}
                        onChange={(e) => updateFilter(filter.id, { operator: e.target.value as FilterOperator })}
                        className="block w-full pl-3 pr-10 py-2 text-sm border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 appearance-none bg-white"
                      >
                        {getOperatorOptions(filter.property).map((op) => (
                          <option key={op.value} value={op.value}>
                            {op.label}
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>

                    {!['is_empty', 'is_not_empty'].includes(filter.operator) && (
                      <input
                        type="text"
                        value={filter.value}
                        onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                        placeholder="Value"
                        className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                      />
                    )}
                  </div>
                </div>
              ))}

              <button
                onClick={addFilter}
                className="w-full flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
              >
                <Icon icon={PlusIcon} size="xs" className="mr-2" />
                Add filter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 