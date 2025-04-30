import { useState, useRef, useEffect } from 'react'
import { Icon } from '@/components/Icon'
import { 
  AdjustmentsHorizontalIcon,
  Bars3Icon,
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  BriefcaseIcon,
  BuildingOfficeIcon,
  MapPinIcon,
  GlobeAltIcon,
  CalendarIcon,
  ViewColumnsIcon,
} from '@heroicons/react/24/outline'
import { createSwapy } from 'swapy'
import debounce from 'lodash/debounce'
import type { ColumnDef } from '@tanstack/react-table'
import type { Attendee, HealthSystem, Conference } from '@/types'

// TODO: drag and drop doesn't work on the columns

type ColumnType = ColumnDef<Attendee | HealthSystem | Conference>

interface PropertiesMenuProps {
  columns: ColumnType[]
  visibleColumns: string[]
  onColumnToggle: (columnId: string) => void
  onColumnOrderChange: (newOrder: string[]) => void
  view: 'table' | 'cards'
  isOpen: boolean
  onToggle: () => void
}

export function PropertiesMenu({
  columns,
  visibleColumns,
  onColumnToggle,
  onColumnOrderChange,
  view,
  isOpen,
  onToggle,
}: PropertiesMenuProps) {
  const [localSearchQuery, setLocalSearchQuery] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const swapyRef = useRef<ReturnType<typeof createSwapy> | null>(null)

  // Memoize the debounced search function
  const debouncedSetSearch = debounce((value: string) => {
    setSearchQuery(value)
  }, 300)

  // Handle search input change with local state
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setLocalSearchQuery(value)
    debouncedSetSearch(value)
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
        return <Icon icon={ViewColumnsIcon} size="sm" className="text-gray-400" />
    }
  }

  // Filter columns based on search query
  const filteredColumns = columns.filter((column) => {
    if (!searchQuery) return true
    const headerStr = String(column.header).toLowerCase()
    return headerStr.includes(searchQuery.toLowerCase()) && column.id !== 'name'
  })

  // Update Swapy initialization
  useEffect(() => {
    const container = document.querySelector('#shown-properties-list') as HTMLElement
    if (!container) return

    // Clean up any existing Swapy instance
    if (swapyRef.current) {
      swapyRef.current.destroy()
    }

    // Create new Swapy instance with basic configuration
    swapyRef.current = createSwapy(container)

    // Set up the swap event handler
    swapyRef.current.onSwap(() => {
      const newOrder = Array.from(container.querySelectorAll('[data-swapy-item]'))
        .map(item => item.getAttribute('data-swapy-item'))
        .filter((id): id is string => id !== null)
      onColumnOrderChange(newOrder)
    })

    return () => {
      if (swapyRef.current) {
        swapyRef.current.destroy()
      }
    }
  }, [columns, view, onColumnOrderChange])

  const renderPropertiesList = () => {
    const shownColumns = filteredColumns.filter(column => 
      column.id === 'name' || visibleColumns.includes(String(column.id))
    )
    const hiddenColumns = filteredColumns.filter(column => 
      column.id !== 'name' && !visibleColumns.includes(String(column.id))
    )

    const viewText = view === 'cards' ? 'Card' : 'Table'

    return (
      <div className="space-y-4">
        <div>
          <div className="text-sm font-medium text-gray-700 mb-2">
            Shown in {viewText}
          </div>
          <div id="shown-properties-list" className="space-y-1">
            {shownColumns.map((column) => {
              const isNameColumn = column.id === 'name'
              const icon = getColumnIcon(String(column.id))
              return (
                <div
                  key={String(column.id)}
                  data-swapy-slot={String(column.id)}
                  className="mb-1"
                >
                  <div
                    data-swapy-item={String(column.id)}
                    className={`flex items-center px-3 py-2 rounded-lg hover:bg-gray-50 ${isNameColumn ? 'opacity-50' : 'cursor-pointer'}`}
                    onClick={(e) => {
                      // Don't toggle if clicking the drag handle or checkbox
                      if ((e.target as HTMLElement).closest('.drag-handle') || 
                          (e.target as HTMLElement).closest('input[type="checkbox"]')) {
                        return;
                      }
                      if (!isNameColumn) {
                        onColumnToggle(String(column.id));
                      }
                    }}
                  >
                    <div className="flex items-center flex-1 min-w-0">
                      {!isNameColumn && (
                        <div 
                          className="flex items-center justify-center w-6 h-6 mr-2 text-gray-400 cursor-grab hover:text-gray-600 hover:bg-gray-100 rounded drag-handle"
                          data-swapy-handle
                        >
                          <Icon icon={Bars3Icon} size="sm" />
                        </div>
                      )}
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
                        onChange={() => !isNameColumn && onColumnToggle(String(column.id))}
                        disabled={isNameColumn}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                    </div>
                  </div>
                </div>
              )
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
                const icon = getColumnIcon(String(column.id))
                return (
                  <div
                    key={String(column.id)}
                    className="mb-1"
                  >
                    <div
                      className="flex items-center px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                      onClick={(e) => {
                        // Don't toggle if clicking the checkbox
                        if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
                          return;
                        }
                        onColumnToggle(String(column.id));
                      }}
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
                          onChange={() => onColumnToggle(String(column.id))}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none menu-button"
      >
        <Icon icon={AdjustmentsHorizontalIcon} size="xs" className="mr-2" />
        Properties
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-md bg-white border border-gray-200 shadow-lg z-50 menu-content">
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
            {renderPropertiesList()}
          </div>
        </div>
      )}
    </div>
  )
} 