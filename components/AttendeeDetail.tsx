import { useState, Fragment } from 'react'
import { 
  UserIcon, 
  BuildingOfficeIcon, 
  EnvelopeIcon,
  PhoneIcon,
  LinkIcon,
  PencilSquareIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentTextIcon,
  AcademicCapIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline'
import { Icon } from '@/components/Icon'
import type { Attendee } from '@/types'
import { supabase } from '@/lib/supabase'
import ApolloIntegration from './ApolloIntegration'
import { ApolloEnrichmentResponse } from '@/lib/apollo'
import { handleEnrichmentComplete as enrichAttendee } from '@/lib/enrichment'
import { Dialog, Transition } from '@headlessui/react'
import { DeleteResultsDialog } from './DeleteResultsDialog'

// Define the DeleteResult type for the dialog
interface DeleteResult {
  attendee: Attendee
  success: boolean
  error?: string
}

interface AttendeeDetailProps {
  attendee: Attendee
  conferenceName?: string
  onBack?: () => void
  onUpdate?: (updatedAttendee: Attendee) => void
  onDelete?: (deletedAttendeeId: string) => void
}

export const AttendeeDetail = ({ attendee, conferenceName, onBack, onUpdate, onDelete }: AttendeeDetailProps) => {
  const [isEditing, setIsEditing] = useState(true)
  const [editData, setEditData] = useState<Attendee | null>({ ...attendee })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showDeleteResults, setShowDeleteResults] = useState(false)
  const [deleteResults, setDeleteResults] = useState<DeleteResult[]>([])

  // Handle edit click
  const handleEditClick = () => {
    setEditData({ ...attendee })
    setIsEditing(true)
  }

  // Handle save changes
  const handleSaveChanges = async () => {
    if (!editData) return
    
    try {
      setIsSaving(true)
      setError(null)
      
      // Create a new object without relationship fields that don't exist as columns in the database
      const updateData = { ...editData }
      // Remove relationship fields that shouldn't be sent to the database
      delete updateData.attendee_conferences
      delete updateData.health_systems
      
      const { data, error: updateError } = await supabase
        .from('attendees')
        .update(updateData)
        .eq('id', editData.id)
        .select()
      
      if (updateError) {
        console.error('Supabase update error:', updateError)
        throw updateError
      }
      
      if (!data || data.length === 0) {
        throw new Error('No data returned after update')
      }
      
      setIsEditing(false)
      
      // If update was successful and there's an onUpdate callback, call it
      if (data.length > 0 && onUpdate) {
        onUpdate(data[0])
      }
    } catch (err) {
      console.error('Full error object:', err)
      setError(err instanceof Error ? err.message : 'An error occurred while saving data')
    } finally {
      setIsSaving(false)
    }
  }
  
  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditData(null)
  }
  
  const handleDeleteConfirm = async () => {
    try {
      setIsDeleting(true)
      setError(null)
      
      const { error: deleteError } = await supabase
        .from('attendees')
        .delete()
        .eq('id', attendee.id)
      
      if (deleteError) {
        console.error('Supabase delete error:', deleteError)
        
        // Store the failure result
        setDeleteResults([
          {
            attendee,
            success: false,
            error: deleteError.message
          }
        ])
        
        throw deleteError
      }
      
      // Store the success result
      setDeleteResults([
        {
          attendee,
          success: true
        }
      ])
      
      setShowDeleteConfirm(false)
      setShowDeleteResults(true)
      
      // If delete was successful and there's an onDelete callback, call it
      if (onDelete) {
        onDelete(attendee.id)
      }
    } catch (err) {
      console.error('Delete error:', err)
      setError(err instanceof Error ? err.message : 'An error occurred while deleting the attendee')
      setShowDeleteConfirm(false)
      setShowDeleteResults(true)
    } finally {
      setIsDeleting(false)
    }
  }
  
  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false)
  }
  
  const handleDeleteResultsClose = () => {
    setShowDeleteResults(false)
  }
  
  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setEditData((prev: Attendee | null) => {
      if (!prev) return null
      return {
        ...prev,
        [name]: value,
      }
    })
  }

  // Function to get a tailwind color class for certification tags
  const getCertColor = (index: number) => {
    const colors = [
      'bg-blue-100 text-blue-800', 
      'bg-green-100 text-green-800',
      'bg-purple-100 text-purple-800',
      'bg-amber-100 text-amber-800',
      'bg-rose-100 text-rose-800',
      'bg-indigo-100 text-indigo-800',
      'bg-emerald-100 text-emerald-800',
      'bg-cyan-100 text-cyan-800',
    ]
    return colors[index % colors.length]
  }

  const handleEnrichmentComplete = async (enrichedData: ApolloEnrichmentResponse) => {
    if (!enrichedData || !enrichedData.matches || enrichedData.matches.length === 0) {
      setError('No enriched data received or no matches found');
      return;
    }

    try {
      await enrichAttendee(
        enrichedData,
        [attendee],
        (updatedAttendees: Attendee[]) => {
          if (updatedAttendees.length > 0) {
            // Update the local attendee state with the enriched data
            const updatedAttendee = updatedAttendees[0];
            // Notify parent component of the update
            onUpdate?.(updatedAttendee);
            setError(null);
          } else {
            setError('No attendees were updated');
          }
        }
      );
    } catch (err) {
      console.error('AttendeeDetail - Error in handleEnrichmentComplete:', err);
      setError(err instanceof Error ? err.message : 'Failed to update attendee with enriched data');
    }
  };

  if (isEditing && editData) {
    // Edit mode - render form with inputs
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 m-6 mb-0">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            </div>
          </div>
        )}
        
        <div className="border-b border-gray-200 p-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                <Icon icon={UserIcon} size="md" className="text-gray-500" />
              </div>
              <div>
                <div className="flex gap-2">
                  <div className="mt-2">
                    <input
                      type="text"
                      name="first_name"
                      value={editData.first_name}
                      onChange={handleInputChange}
                      className="block w-full rounded-md bg-white px-3 py-1.5 text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 sm:text-sm/6"
                      placeholder="First Name"
                    />
                  </div>
                  <div className="mt-2">
                    <input
                      type="text"
                      name="last_name"
                      value={editData.last_name}
                      onChange={handleInputChange}
                      className="block w-full rounded-md bg-white px-3 py-1.5 text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 sm:text-sm/6"
                      placeholder="Last Name"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={handleCancelEdit}
                className="inline-flex items-center gap-x-1.5 rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                disabled={isSaving}
              >
                <XCircleIcon className="-ml-0.5 h-5 w-5" aria-hidden="true" />
                Cancel
              </button>
              <button 
                onClick={handleSaveChanges}
                className="inline-flex items-center gap-x-1.5 rounded-md bg-indigo-600 px-2.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <svg className="-ml-0.5 h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="-ml-0.5 h-5 w-5" aria-hidden="true" />
                    Save
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        
        <div className="px-6 py-5 divide-y divide-gray-200">
          <div className="grid grid-cols-3 gap-6 py-4">
            <div className="col-span-1 flex items-center">
              <UserIcon className="h-5 w-5 text-gray-400 mr-2" />
              <label htmlFor="title" className="block text-sm font-medium text-gray-700">Title</label>
            </div>
            <div className="col-span-2">
              <div className="mt-2">
                <input
                  type="text"
                  name="title"
                  id="title"
                  value={editData.title || ''}
                  onChange={handleInputChange}
                  className="block w-full rounded-md bg-white px-3 py-1.5 text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 sm:text-sm/6"
                  placeholder="Job Title"
                />
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-6 py-4">
            <div className="col-span-1 flex items-center">
              <BuildingOfficeIcon className="h-5 w-5 text-gray-400 mr-2" />
              <label htmlFor="company" className="block text-sm font-medium text-gray-700">Company</label>
            </div>
            <div className="col-span-2">
              <div className="mt-2">
                <input
                  type="text"
                  name="company"
                  id="company"
                  value={editData.company || ''}
                  onChange={handleInputChange}
                  className="block w-full rounded-md bg-white px-3 py-1.5 text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 sm:text-sm/6"
                  placeholder="Company or Organization"
                />
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-6 py-4">
            <div className="col-span-1 flex items-center">
              <EnvelopeIcon className="h-5 w-5 text-gray-400 mr-2" />
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
            </div>
            <div className="col-span-2">
              <div className="mt-2">
                <input
                  type="email"
                  name="email"
                  id="email"
                  value={editData.email || ''}
                  onChange={handleInputChange}
                  className="block w-full rounded-md bg-white px-3 py-1.5 text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 sm:text-sm/6"
                  placeholder="Email Address"
                />
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-6 py-4">
            <div className="col-span-1 flex items-center">
              <PhoneIcon className="h-5 w-5 text-gray-400 mr-2" />
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Phone</label>
            </div>
            <div className="col-span-2">
              <div className="mt-2">
                <input
                  type="text"
                  name="phone"
                  id="phone"
                  value={editData.phone || ''}
                  onChange={handleInputChange}
                  className="block w-full rounded-md bg-white px-3 py-1.5 text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 sm:text-sm/6"
                  placeholder="Phone Number"
                />
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-6 py-4">
            <div className="col-span-1 flex items-center">
              <LinkIcon className="h-5 w-5 text-gray-400 mr-2" />
              <label htmlFor="linkedin_url" className="block text-sm font-medium text-gray-700">LinkedIn</label>
            </div>
            <div className="col-span-2">
              <div className="mt-2">
                <input
                  type="url"
                  name="linkedin_url"
                  id="linkedin_url"
                  value={editData.linkedin_url || ''}
                  onChange={handleInputChange}
                  className="block w-full rounded-md bg-white px-3 py-1.5 text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 sm:text-sm/6"
                  placeholder="LinkedIn URL"
                />
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-6 py-4">
            <div className="col-span-1 flex items-start pt-2">
              <DocumentTextIcon className="h-5 w-5 text-gray-400 mr-2" />
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700">Notes</label>
            </div>
            <div className="col-span-2">
              <div className="mt-2">
                <textarea
                  name="notes"
                  id="notes"
                  rows={3}
                  value={editData.notes || ''}
                  onChange={handleInputChange}
                  className="block w-full rounded-md bg-white px-3 py-1.5 text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 sm:text-sm/6"
                  placeholder="Add notes about this attendee"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  // View mode - render in description list format
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 m-6 mb-0">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      <div className="border-b border-gray-200 p-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
              <Icon icon={UserIcon} size="md" className="text-gray-500" />
            </div>
            <div>
              <h2 className="text-xl font-medium text-gray-900">
                {attendee.first_name} {attendee.last_name}
              </h2>
              {attendee.title && <p className="text-gray-500">{attendee.title}</p>}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {onBack && (
              <button 
                onClick={onBack}
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-150"
              >
                <ArrowLeftIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                Back to List
              </button>
            )}
            <button 
              onClick={handleEditClick}
              className="inline-flex items-center justify-center rounded-full bg-white p-1.5 text-gray-500 shadow-sm border border-gray-200 hover:text-gray-700 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              title="Edit"
            >
              <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Edit</span>
            </button>
          </div>
        </div>
      </div>
      
      <div className="px-6 py-5 divide-y divide-gray-200">
        {attendee.company && (
          <div className="grid grid-cols-3 gap-4 py-4">
            <div className="col-span-1 flex items-center">
              <BuildingOfficeIcon className="h-5 w-5 text-gray-400 mr-2" />
              <span className="text-sm font-medium text-gray-500">Company</span>
            </div>
            <div className="col-span-2 text-sm text-gray-900">
              {attendee.company}
            </div>
          </div>
        )}
        
        {attendee.email && (
          <div className="grid grid-cols-3 gap-4 py-4">
            <div className="col-span-1 flex items-center">
              <EnvelopeIcon className="h-5 w-5 text-gray-400 mr-2" />
              <span className="text-sm font-medium text-gray-500">Email</span>
            </div>
            <div className="col-span-2 text-sm">
              <a href={`mailto:${attendee.email}`} className="text-primary-600 hover:text-primary-900">
                {attendee.email}
              </a>
            </div>
          </div>
        )}
        
        {attendee.phone && (
          <div className="grid grid-cols-3 gap-4 py-4">
            <div className="col-span-1 flex items-center">
              <PhoneIcon className="h-5 w-5 text-gray-400 mr-2" />
              <span className="text-sm font-medium text-gray-500">Phone</span>
            </div>
            <div className="col-span-2 text-sm">
              <a href={`tel:${attendee.phone}`} className="text-primary-600 hover:text-primary-900">
                {attendee.phone}
              </a>
            </div>
          </div>
        )}
        
        {attendee.linkedin_url && (
          <div className="grid grid-cols-3 gap-4 py-4">
            <div className="col-span-1 flex items-center">
              <LinkIcon className="h-5 w-5 text-gray-400 mr-2" />
              <span className="text-sm font-medium text-gray-500">LinkedIn</span>
            </div>
            <div className="col-span-2 text-sm">
              <a 
                href={attendee.linkedin_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary-600 hover:text-primary-900"
              >
                View Profile
              </a>
            </div>
          </div>
        )}
        
        {attendee.notes && (
          <div className="grid grid-cols-3 gap-4 py-4">
            <div className="col-span-1 flex items-start pt-1">
              <DocumentTextIcon className="h-5 w-5 text-gray-400 mr-2" />
              <span className="text-sm font-medium text-gray-500">Notes</span>
            </div>
            <div className="col-span-2 text-sm text-gray-700">
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="whitespace-pre-line">{attendee.notes}</p>
              </div>
            </div>
          </div>
        )}
        
        {attendee.certifications && attendee.certifications.length > 0 && (
          <div className="grid grid-cols-3 gap-4 py-4">
            <div className="col-span-1 flex items-center">
              <AcademicCapIcon className="h-5 w-5 text-gray-400 mr-2" />
              <span className="text-sm font-medium text-gray-500">Certifications</span>
            </div>
            <div className="col-span-2">
              <div className="flex flex-wrap gap-2">
                {attendee.certifications.map((cert, idx) => (
                  <span 
                    key={idx} 
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getCertColor(idx)}`}
                  >
                    {cert}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Add Apollo Integration section */}
      <div className="px-6 py-5 border-t border-gray-200">
        <ApolloIntegration
          selectedAttendees={[attendee]}
          conferenceName={conferenceName || 'Unknown Conference'}
          onEnrichmentComplete={handleEnrichmentComplete}
        />
      </div>
      
      {/* Delete Confirmation Dialog */}
      <Transition.Root show={showDeleteConfirm} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={setShowDeleteConfirm}>
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
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                  <div>
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                      <XCircleIcon className="h-6 w-6 text-red-600" aria-hidden="true" />
                    </div>
                    <div className="mt-3 text-center sm:mt-5">
                      <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900">
                        Remove Attendee
                      </Dialog.Title>
                      <div className="mt-2">
                        <p className="text-sm text-gray-500">
                          Are you sure you want to delete {attendee.first_name} {attendee.last_name}? This action cannot be undone.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                    <button
                      type="button"
                      className="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 sm:col-start-2"
                      onClick={handleDeleteConfirm}
                      disabled={isDeleting}
                    >
                      {isDeleting ? 'Deleting...' : 'Delete'}
                    </button>
                    <button
                      type="button"
                      className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0"
                      onClick={handleDeleteCancel}
                      disabled={isDeleting}
                    >
                      Cancel
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
      
      {/* Delete Results Dialog */}
      <DeleteResultsDialog 
        isOpen={showDeleteResults}
        onClose={handleDeleteResultsClose}
        results={deleteResults}
      />
    </div>
  )
} 