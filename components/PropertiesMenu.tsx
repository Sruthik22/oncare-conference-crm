import { useState } from 'react'
import { Icon } from '@/components/Icon'
import { AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline'
import { useDatabaseSchema } from '@/hooks/useDatabaseSchema'
import { getIconComponent } from '@/utils/iconUtils'
import { getColumnIconName } from '@/hooks/useColumnManagement'

interface PropertiesMenuProps {
  activeTab: string
  visibleColumns: string[]
  onColumnToggle: (columnId: string) => void
  view: 'table' | 'cards'
  isOpen: boolean
  onToggle: () => void
}

export function PropertiesMenu({
  activeTab,
  visibleColumns,
  onColumnToggle,
  view,
  isOpen,
  onToggle,
}: PropertiesMenuProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const { columns, loading } = useDatabaseSchema()

  // Get columns for the active tab
  const tabColumns = columns.filter(col => {
    switch (activeTab) {
      case 'attendees':
        return col.table === 'attendees'
      case 'health-systems':
        return col.table === 'health_systems'
      case 'conferences':
        return col.table === 'conferences'
      default:
        return false
    }
  })

  // Get a rendered icon for a column
  const getColumnIcon = (columnId: string) => {
    const iconName = getColumnIconName(columnId);
    const IconComponent = getIconComponent(iconName);
    return <Icon icon={IconComponent} size="sm" className="text-gray-400" />;
  }

  // Filter columns based on search query
  const filteredColumns = tabColumns.filter((column) => {
    if (!searchQuery) return true
    const headerStr = String(column.header).toLowerCase()
    return headerStr.includes(searchQuery.toLowerCase())
  })

  const renderPropertiesList = () => {
    const viewText = view === 'cards' ? 'Card' : 'Table'
    
    // Separate shown and hidden columns
    const shownColumns = filteredColumns.filter(column => 
      visibleColumns.includes(String(column.id))
    )
    
    const hiddenColumns = filteredColumns.filter(column => 
      !visibleColumns.includes(String(column.id))
    )

    if (loading) {
      return (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-500">Loading columns...</p>
        </div>
      )
    }

    if (filteredColumns.length === 0) {
      return (
        <div className="text-center py-4">
          <p className="text-sm text-gray-500">No properties available for this entity</p>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {shownColumns.length > 0 && (
          <div>
            <div className="text-sm font-medium text-gray-700 mb-2">
              Shown in {viewText}
            </div>
            <div className="space-y-1">
              {shownColumns.map((column) => {
                const icon = getColumnIcon(String(column.id))
                return (
                  <div
                    key={String(column.id)}
                    className="flex items-center px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => onColumnToggle(String(column.id))}
                  >
                    <div className="flex items-center flex-1 min-w-0">
                      <div className="flex items-center justify-center w-6 h-6 mr-3">
                        {icon}
                      </div>
                      <span className="text-sm text-gray-900 truncate">
                        {String(column.header)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {hiddenColumns.length > 0 && (
          <div>
            <div className="text-sm font-medium text-gray-700 mb-2">
              Not Shown in {viewText}
            </div>
            <div className="space-y-1">
              {hiddenColumns.map((column) => {
                const icon = getColumnIcon(String(column.id))
                return (
                  <div
                    key={String(column.id)}
                    className="flex items-center px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => onColumnToggle(String(column.id))}
                  >
                    <div className="flex items-center flex-1 min-w-0">
                      <div className="flex items-center justify-center w-6 h-6 mr-3">
                        {icon}
                      </div>
                      <span className="text-sm text-gray-900 truncate">
                        {String(column.header)}
                      </span>
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
                type="text"
                placeholder="Search for a property..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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