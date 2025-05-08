import { Icon } from '@/components/ui/Icon'
import { ViewColumnsIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'

interface ViewSettingsMenuProps {
  columnsPerRow: number
  onColumnsPerRowChange: (columns: number) => void
  isOpen: boolean
  onToggle: () => void
}

export function ViewSettingsMenu({
  columnsPerRow,
  onColumnsPerRowChange,
  isOpen,
  onToggle,
}: ViewSettingsMenuProps) {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="p-2 rounded-md bg-white text-gray-500 hover:bg-gray-50 border border-gray-300 transition-colors flex items-center justify-center menu-button"
        aria-label="View settings"
      >
        <Icon icon={Cog6ToothIcon} size="sm" />
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-md bg-white border border-gray-200 shadow-lg z-50 menu-content">
          <div className="p-4">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <Icon icon={ViewColumnsIcon} size="sm" className="mr-2 text-gray-400" />
                  Columns per row
                </label>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onColumnsPerRowChange(Math.max(1, columnsPerRow - 1))}
                    disabled={columnsPerRow <= 1}
                    className={`p-1 rounded-md ${
                      columnsPerRow <= 1
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    -
                  </button>
                  <span className="text-sm text-gray-900">{columnsPerRow}</span>
                  <button
                    onClick={() => onColumnsPerRowChange(Math.min(4, columnsPerRow + 1))}
                    disabled={columnsPerRow >= 4}
                    className={`p-1 rounded-md ${
                      columnsPerRow >= 4
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 