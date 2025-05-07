import { ReactNode } from 'react'
import { useSelection } from '@/lib/context/SelectionContext'
import { Checkbox } from '@/components/ui/checkbox'
import { IconName } from '@/hooks/useColumnManagement'
import { Icon } from '@/components/Icon'
import { getIconComponent } from '@/utils/iconUtils'

interface FieldDisplayProps {
  label: string
  value: string
  iconName: IconName
}

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
  fields?: FieldDisplayProps[] // Add support for passing field data directly
}

export function ItemCard({ 
  title, 
  subtitle, 
  tags, 
  children, 
  onClick, 
  icon, 
  item, 
  itemType = 'default',
  fields = []
}: ItemCardProps) {
  const { selectedItems, toggleSelection } = useSelection()
  const isSelected = item ? selectedItems.some(selectedItem => selectedItem.id === item.id) : false

  const handleClick = (e: React.MouseEvent) => {
    // Prevent card click if clicking the checkbox
    if ((e.target as HTMLElement).closest('.checkbox-container')) {
      return
    }
    // Prevent card click if clicking a link
    if ((e.target as HTMLElement).closest('a')) {
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

  // Function to format field values based on their content
  const renderFieldValue = (field: FieldDisplayProps) => {
    const { label, value } = field;
    
    if (!value) return <span className="text-gray-400 ml-2">-</span>;
    
    // Email fields
    if (label.toLowerCase() === 'email' || value.includes('@')) {
      return <a href={`mailto:${value}`} className="text-primary-600 ml-2 hover:underline truncate">{value}</a>;
    }
    
    // URL/Website fields
    if (label.toLowerCase() === 'website' || 
        label.toLowerCase().includes('url') ||
        value.startsWith('http')) {
      return <a href={value} target="_blank" rel="noopener noreferrer" className="text-primary-600 ml-2 hover:underline truncate">{value}</a>;
    }
    
    // Phone fields
    if (label.toLowerCase() === 'phone') {
      return <a href={`tel:${value}`} className="text-primary-600 ml-2 hover:underline">{value}</a>;
    }
    
    // Date fields
    if (label.toLowerCase().includes('date') || 
        value.match(/^\d{4}-\d{2}-\d{2}/) ||
        value.match(/^\d{2}\/\d{2}\/\d{4}/)) {
      try {
        return <span className="text-gray-900 ml-2">{new Date(value).toLocaleDateString()}</span>;
      } catch (e) {
        // If date parsing fails, just display the original value
        return <span className="text-gray-900 ml-2">{value}</span>;
      }
    }
    
    // Default display
    return <span className="text-gray-900 ml-2 truncate">{value}</span>;
  };

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
          
          {/* Display fields array if provided */}
          {fields && fields.length > 0 && (
            <div className="mt-3 space-y-2 text-sm text-gray-600 overflow-hidden">
              {fields.map((field, index) => (
                <div key={index} className="flex items-start">
                  <div className="flex items-center min-w-[100px] text-gray-500">
                    <div className="w-5 h-5 mr-2">
                      <Icon icon={getIconComponent(field.iconName)} size="sm" className="text-gray-400" />
                    </div>
                    <span className="truncate">{field.label}:</span>
                  </div>
                  {renderFieldValue(field)}
                </div>
              ))}
            </div>
          )}
          
          {/* If children is provided, render it */}
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