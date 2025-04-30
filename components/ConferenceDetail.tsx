import { useState } from 'react'
import { 
  CalendarIcon, 
  MapPinIcon, 
  PencilIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { Icon } from '@/components/Icon'
import type { Conference } from '@/types'
import { supabase } from '@/lib/supabase'

interface ConferenceDetailProps {
  conference: Conference
  onUpdate: (updatedConference: Conference) => void
}

export const ConferenceDetail = ({ conference, onUpdate }: ConferenceDetailProps) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Conference | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Handle edit click
  const handleEditClick = () => {
    setEditData({ ...conference })
    setIsEditing(true)
  }

  // Handle save changes
  const handleSaveChanges = async () => {
    if (!editData) return
    
    try {
      setIsSaving(true)
      setError(null)
      
      const { error: updateError } = await supabase
        .from('conferences')
        .update(editData)
        .eq('id', editData.id)
        
      if (updateError) throw updateError
      
      // Call the update callback to update parent state
      onUpdate(editData)
      setIsEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while saving data')
      console.error('Error saving data:', err)
    } finally {
      setIsSaving(false)
    }
  }

  // Handle cancel edit
  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditData(null)
  }
  
  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setEditData((prev: Conference | null) => {
      if (!prev) return null
      return {
        ...prev,
        [name]: value,
      }
    })
  }

  if (isEditing && editData) {
    // Edit mode - render form with inputs
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 animate-fade-in">
        {error && (
          <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}
        
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <div className="bg-secondary-100 p-3 rounded-full icon-container w-12 h-12 mr-4">
              <Icon icon={CalendarIcon} size="md" className="text-secondary-600" />
            </div>
            <div>
              <input
                type="text"
                name="name"
                value={editData.name}
                onChange={handleInputChange}
                className="font-semibold text-lg border-b border-gray-300 focus:border-secondary-500 focus:ring-0 px-1 py-0 w-64"
              />
              <div className="text-gray-500 text-sm">Editing Conference</div>
            </div>
          </div>
          
          <div className="flex space-x-2">
            <button 
              onClick={handleCancelEdit}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded shadow-sm text-gray-700 bg-white hover:bg-gray-50"
              disabled={isSaving}
            >
              <Icon icon={XMarkIcon} size="xs" className="mr-1.5" />
              Cancel
            </button>
            <button 
              onClick={handleSaveChanges}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded shadow-sm text-white bg-primary-600 hover:bg-primary-700"
              disabled={isSaving}
            >
              {isSaving ? (
                <span className="inline-flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </span>
              ) : (
                <>
                  <Icon icon={CheckIcon} size="xs" className="mr-1.5" />
                  Save
                </>
              )}
            </button>
          </div>
        </div>
        
        <div className="border-t border-gray-200 px-4 py-5 sm:p-0 mt-4">
          <dl className="sm:divide-y sm:divide-gray-200">
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-gray-500">Start Date</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                <input
                  type="date"
                  name="start_date"
                  value={editData.start_date || ''}
                  onChange={handleInputChange}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
              </dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-gray-500">End Date</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                <input
                  type="date"
                  name="end_date"
                  value={editData.end_date || ''}
                  onChange={handleInputChange}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                />
              </dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-gray-500">Location</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                <input
                  type="text"
                  name="location"
                  value={editData.location || ''}
                  onChange={handleInputChange}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                  placeholder="Conference Location"
                />
              </dd>
            </div>
          </dl>
        </div>
      </div>
    )
  }
  
  // View mode - render in description list format
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <div className="bg-secondary-100 p-3 rounded-full icon-container w-12 h-12 mr-4">
            <Icon icon={CalendarIcon} size="md" className="text-secondary-600" />
          </div>
          <div>
            <h2 className="font-semibold text-xl text-gray-900">
              {conference.name}
            </h2>
          </div>
        </div>
        
        <button 
          onClick={handleEditClick}
          className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded shadow-sm text-white bg-primary-600 hover:bg-primary-700"
        >
          <Icon icon={PencilIcon} size="xs" className="mr-1.5" />
          Edit
        </button>
      </div>
      
      <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
        <dl className="sm:divide-y sm:divide-gray-200">
          {conference.start_date && (
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-gray-500">Date</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 flex items-center">
                <Icon icon={CalendarIcon} size="xs" className="mr-2 text-gray-400" />
                <span>
                  {new Date(conference.start_date).toLocaleDateString()}
                  {conference.end_date && ` - ${new Date(conference.end_date).toLocaleDateString()}`}
                </span>
              </dd>
            </div>
          )}
          
          {conference.location && (
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-gray-500">Location</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 flex items-center">
                <Icon icon={MapPinIcon} size="xs" className="mr-2 text-gray-400" />
                {conference.location}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  )
} 