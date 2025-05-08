import { useState, useEffect } from 'react'
import { Icon } from '@/components/Icon'
import { 
  FunnelIcon,
  XMarkIcon,
  PlusIcon,
} from '@heroicons/react/24/outline'
import { getIconComponent } from '@/utils/iconUtils'
import { getColumnIconName } from '@/hooks/useColumnManagement'
import type { ColumnDef } from '@tanstack/react-table'
import type { Attendee, HealthSystem, Conference } from '@/types'

// Define the column meta data interface to match what we expect
interface ColumnMeta {
  isForeignKey?: boolean
  foreignTable?: string
  dataType?: string
}

type FilterOperator = 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'is_empty' | 'is_not_empty' | 'greater_than' | 'less_than'

interface Filter {
  id: string
  property: string
  operator: FilterOperator
  value: string
}

interface FilterMenuProps {
  onFilterChange: (filters: Filter[]) => void
  isOpen: boolean
  onToggle: () => void
  allColumns: ColumnDef<Attendee | HealthSystem | Conference>[]
  isLoading?: boolean
  activeFilters?: Filter[]
}

export function FilterMenu({ onFilterChange, isOpen, onToggle, allColumns, isLoading = false, activeFilters = [] }: FilterMenuProps) {
  const [filters, setFilters] = useState<Filter[]>([])
  const [activeFilter, setActiveFilter] = useState<Filter | null>(null)

  // Synchronize the local state with parent's activeFilters
  useEffect(() => {
    if (isOpen && activeFilters) {
      setFilters(activeFilters)
    }
  }, [isOpen, activeFilters])

  const addFilter = () => {
    if (allColumns.length === 0) return
    
    const newFilter: Filter = {
      id: Math.random().toString(36).substr(2, 9),
      property: String(allColumns[0]?.id || ''),
      operator: 'equals',
      value: ''
    }
    setFilters([...filters, newFilter])
    setActiveFilter(newFilter)
    onFilterChange([...filters, newFilter])
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
    const column = allColumns.find(c => String(c.id) === property)
    if (!column) return []

    // Get data type from column metadata
    const meta = column.meta as ColumnMeta | undefined
    const dataType = meta?.dataType
    
    // Date operators - based on data type or column name
    if (dataType === 'date' || dataType === 'timestamp' || dataType?.includes('time')) {
      return [
        { value: 'equals', label: 'Equals' },
        { value: 'greater_than', label: 'After' },
        { value: 'less_than', label: 'Before' },
        { value: 'is_empty', label: 'Is empty' },
        { value: 'is_not_empty', label: 'Is not empty' },
      ]
    }

    // Numeric operators - based on data type or column name
    if (dataType === 'integer' || dataType === 'numeric' || dataType === 'real' || dataType === 'double precision') {
      return [
        { value: 'equals', label: 'Equals' },
        { value: 'greater_than', label: 'Greater than' },
        { value: 'less_than', label: 'Less than' },
        { value: 'is_empty', label: 'Is empty' },
        { value: 'is_not_empty', label: 'Is not empty' },
      ]
    }

    // Boolean operators
    if (dataType === 'boolean') {
      return [
        { value: 'equals', label: 'Equals' },
        { value: 'is_empty', label: 'Is empty' },
        { value: 'is_not_empty', label: 'Is not empty' },
      ]
    }

    // Array operators (for comma-separated values)
    if (dataType?.includes('array')) {
      return [
        { value: 'contains', label: 'Contains' },
        { value: 'equals', label: 'Equals' },
        { value: 'is_empty', label: 'Is empty' },
        { value: 'is_not_empty', label: 'Is not empty' },
      ]
    }

    // Default to text operators for other fields/string types
    return [
      { value: 'equals', label: 'Equals' },
      { value: 'contains', label: 'Contains' },
      { value: 'starts_with', label: 'Starts with' },
      { value: 'ends_with', label: 'Ends with' },
      { value: 'is_empty', label: 'Is empty' },
      { value: 'is_not_empty', label: 'Is not empty' },
    ]
  }

  // Get rendered icon for a column
  const getColumnIcon = (columnId: string) => {
    const iconName = getColumnIconName(columnId);
    const IconComponent = getIconComponent(iconName);
    return <Icon icon={IconComponent} size="sm" className="text-gray-400" />;
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

            {isLoading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-500">Loading columns...</p>
              </div>
            ) : allColumns.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500">No columns available for filtering</p>
              </div>
            ) : (
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
                          {allColumns.map((column) => (
                            <option key={String(column.id)} value={String(column.id)}>
                              {String(column.header)}
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
                        <div>
                          {(() => {
                            const column = allColumns.find(c => String(c.id) === filter.property);
                            const meta = column?.meta as ColumnMeta | undefined;
                            const dataType = meta?.dataType;
                            
                            // Date input for date fields
                            if (dataType === 'date' || dataType === 'timestamp' || dataType?.includes('time') ||
                                filter.property.includes('date') || filter.property.includes('time') || 
                                filter.property === 'created_at' || filter.property === 'updated_at') {
                              
                              // Use datetime-local for timestamp fields
                              if (dataType === 'timestamp' || dataType?.includes('time')) {
                                return (
                                  <input
                                    type="datetime-local"
                                    value={filter.value}
                                    onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                                    className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                                  />
                                );
                              }
                              
                              // Use date for date-only fields
                              return (
                                <input
                                  type="date"
                                  value={filter.value}
                                  onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                                  className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                                />
                              );
                            }
                            
                            // Number input for numeric fields
                            if (dataType === 'integer' || dataType === 'numeric' || dataType === 'real' || dataType === 'double precision' ||
                                filter.property.includes('count') || filter.property.includes('revenue') || 
                                filter.property.includes('price') || filter.property.includes('amount')) {
                              return (
                                <input
                                  type="number"
                                  value={filter.value}
                                  onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                                  className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                                />
                              );
                            }
                            
                            // Boolean select for boolean fields
                            if (dataType === 'boolean') {
                              return (
                                <select
                                  value={filter.value}
                                  onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                                  className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                                >
                                  <option value="true">True</option>
                                  <option value="false">False</option>
                                </select>
                              );
                            }
                            
                            // Default text input for other fields
                            return (
                              <input
                                type="text"
                                value={filter.value}
                                onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                                placeholder="Value"
                                className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                              />
                            );
                          })()}
                        </div>
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
            )}
          </div>
        </div>
      )}
    </div>
  )
} 