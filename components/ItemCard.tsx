import { ReactNode } from 'react'
import { useSelection } from '@/lib/context/SelectionContext'
import { Checkbox } from '@/components/ui/checkbox'

interface ItemCardProps {
  title: string
  subtitle?: string
  tags?: { text: string; color: 'primary' | 'secondary' | 'accent' | 'gray' }[]
  children?: ReactNode
  onClick?: () => void
  icon?: ReactNode
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  item?: any // The item being represented by this card
  itemType?: 'attendee' | 'healthSystem' | 'conference' | 'default'
}

export function ItemCard({ 
  title, 
  subtitle, 
  tags, 
  children, 
  onClick, 
  icon, 
  item, 
  itemType = 'default' 
}: ItemCardProps) {
  const { selectedItems, toggleSelection } = useSelection()
  const isSelected = item ? selectedItems.some(selectedItem => selectedItem.id === item.id) : false

  const handleClick = (e: React.MouseEvent) => {
    // Prevent card click if clicking the checkbox
    if ((e.target as HTMLElement).closest('.checkbox-container')) {
      return
    }
    onClick?.()
  }

  const handleCheckboxChange = () => {
    if (item) {
      toggleSelection(item)
    }
  }

  // Only show subtitle for attendees or when itemType is default
  const shouldShowSubtitle = subtitle && (itemType === 'attendee');

  return (
    <div 
      className="bg-white rounded-xl border border-gray-100 shadow-card hover:shadow-card-hover p-5 
                transition-all duration-200 ease-in-out transform hover:-translate-y-1 cursor-pointer relative"
      onClick={handleClick}
    >
      {item && (
        <div className="checkbox-container absolute top-4 right-4 z-10">
          <Checkbox 
            checked={isSelected} 
            onChange={handleCheckboxChange}
          />
        </div>
      )}
      <div className="flex items-start space-x-4">
        {icon && (
          <div className="flex-shrink-0 icon-container bg-gray-50 p-2 rounded-lg w-10 h-10">
            {icon}
          </div>
        )}
        <div className="flex-grow min-w-0">
          <div className="flex items-center space-x-2">
            <h3 className="text-lg font-medium text-gray-900 truncate group-hover:text-primary-600 transition-colors duration-200">
              {title}
            </h3>
          </div>
          {shouldShowSubtitle && (
            <p className="text-sm text-gray-500 mt-1 truncate">
              {subtitle}
            </p>
          )}
          {tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {tags.map((tag, index) => (
                <span key={index} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                  ${tag.color === 'primary' ? 'bg-primary-100 text-primary-800' : 
                    tag.color === 'secondary' ? 'bg-secondary-100 text-secondary-800' : 
                    tag.color === 'accent' ? 'bg-accent-100 text-accent-800' : 
                    'bg-gray-100 text-gray-800'}`}>
                  {tag.text}
                </span>
              ))}
            </div>
          )}
          {children && (
            <div className="mt-3 text-sm text-gray-600">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 