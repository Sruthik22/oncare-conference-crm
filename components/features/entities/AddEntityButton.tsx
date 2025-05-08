import { useState, Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { AttendeeDetailAdapter } from '../attendees/AttendeeDetailAdapter'
import { ConferenceDetailAdapter } from '../conferences/ConferenceDetailAdapter'
import { HealthSystemDetailAdapter } from '../health-systems/HealthSystemDetailAdapter'
import type { Attendee, Conference, HealthSystem } from '@/types'

// Helper to generate a valid UUID format
const generateTempUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

interface AddEntityButtonProps {
  entityType: 'attendees' | 'health-systems' | 'conferences'
  buttonLabel?: string
  onEntityAdded: (entity: Attendee | Conference | HealthSystem) => void
  className?: string
  currentConferenceName?: string
}

export const AddEntityButton = ({
  entityType,
  buttonLabel,
  onEntityAdded,
  className = '',
  currentConferenceName
}: AddEntityButtonProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Create empty entity templates based on entityType
  const getEmptyEntity = () => {
    // Generate a temporary UUID to avoid database errors
    const tempId = generateTempUUID();
    
    switch (entityType) {
      case 'attendees':
        return {
          id: tempId,
          first_name: '',
          last_name: '',
          certifications: [],
          title: '',
          company: '',
          email: '',
          phone: '',
          linkedin_url: '',
          notes: '',
          attendee_conferences: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          _isNew: true // Special flag to indicate this is a new entity
        } as Attendee & { _isNew: boolean }
      case 'conferences':
        return {
          id: tempId,
          name: '',
          start_date: '',
          end_date: '',
          location: '',
          attendee_conferences: [],
          created_at: new Date().toISOString(),
          _isNew: true
        } as Conference & { _isNew: boolean }
      case 'health-systems':
        return {
          id: tempId,
          name: '',
          website: '',
          address: '',
          city: '',
          state: '',
          zip: '',
          created_at: new Date().toISOString(),
          _isNew: true
        } as HealthSystem & { _isNew: boolean }
      default:
        throw new Error(`Unknown entity type: ${entityType}`)
    }
  }

  const handleOpen = () => {
    setIsOpen(true)
    setError(null)
  }

  const handleClose = () => {
    setIsOpen(false)
  }

  // Handle entity creation update
  const handleEntityUpdate = (entity: Attendee | Conference | HealthSystem) => {
    // Close the dialog and notify parent
    setIsOpen(false)
    onEntityAdded(entity)
  }

  // Create a DeleteButton that does nothing since we're creating a new entity
  const handleDelete = () => {
    console.log('Delete not applicable for new entity')
    return
  }

  const renderEntityForm = () => {
    const emptyEntity = getEmptyEntity()
    
    switch (entityType) {
      case 'attendees':
        return (
          <AttendeeDetailAdapter
            attendee={emptyEntity as Attendee}
            onUpdate={handleEntityUpdate as (updatedAttendee: Attendee) => void}
            onDelete={handleDelete}
            conferenceName={currentConferenceName}
            isNewEntity={true}
          />
        )
      case 'conferences':
        return (
          <ConferenceDetailAdapter
            conference={emptyEntity as Conference}
            onUpdate={handleEntityUpdate as (updatedConference: Conference) => void}
            onDelete={handleDelete}
            isNewEntity={true}
          />
        )
      case 'health-systems':
        return (
          <HealthSystemDetailAdapter
            healthSystem={emptyEntity as HealthSystem}
            onUpdate={handleEntityUpdate as (updatedHealthSystem: HealthSystem) => void}
            onDelete={handleDelete}
            isNewEntity={true}
          />
        )
      default:
        return <div>Unknown entity type</div>
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className={`inline-flex items-center gap-x-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${className}`}
      >
        <PlusIcon className="-ml-0.5 h-5 w-5" aria-hidden="true" />
        {buttonLabel || `Add ${entityType === 'attendees' 
          ? 'Attendee' 
          : entityType === 'conferences' 
            ? 'Conference' 
            : 'Health System'}`}
      </button>

      <Transition.Root show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={handleClose}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-75 transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl">
                  <div className="absolute right-0 top-0 pr-4 pt-4">
                    <button
                      type="button"
                      className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                      onClick={handleClose}
                    >
                      <span className="sr-only">Close</span>
                      <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                    </button>
                  </div>
                  
                  <div className="p-4 sm:p-6 max-h-[80vh] overflow-y-auto">
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 mb-4">
                      Add New {entityType === 'attendees' 
                      ? 'Attendee' 
                      : entityType === 'conferences' 
                        ? 'Conference' 
                        : 'Health System'}
                    </Dialog.Title>
                    
                    {error && (
                      <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
                        <div className="flex">
                          <div className="ml-3">
                            <p className="text-sm text-red-700 font-medium">{error}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {renderEntityForm()}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
    </>
  )
} 