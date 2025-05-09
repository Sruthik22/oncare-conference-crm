import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import type { Attendee, Conference, HealthSystem } from '@/types'
import { EntityDeleteResult } from '@/components/features/entities/EntityDetail'

// Existing specific result types for backward compatibility
export interface AttendeeDeleteResult {
  attendee: Attendee
  success: boolean
  error?: string
}

export interface ConferenceDeleteResult {
  conference: Conference
  success: boolean
  error?: string
}

export interface HealthSystemDeleteResult {
  healthSystem: HealthSystem
  success: boolean
  error?: string
}

type DeleteResultType = AttendeeDeleteResult | ConferenceDeleteResult | HealthSystemDeleteResult | EntityDeleteResult

interface DeleteResultsDialogProps {
  isOpen: boolean
  onClose: () => void
  results: DeleteResultType[]
}

export const DeleteResultsDialog = ({ isOpen, onClose, results }: DeleteResultsDialogProps) => {
  // Get the entity name and type from each result
  const getEntityInfo = (result: DeleteResultType) => {
    // Handle the new EntityDeleteResult type
    if ('entity' in result && 'entityType' in result) {
      const { entity, entityType } = result;
      
      if (entityType === 'attendee') {
        const attendee = entity as Attendee;
        return { 
          name: `${attendee.first_name} ${attendee.last_name}`, 
          type: 'Attendee' 
        };
      } else if (entityType === 'conference') {
        const conference = entity as Conference;
        return { 
          name: conference.name, 
          type: 'Conference' 
        };
      } else if (entityType === 'healthSystem') {
        const healthSystem = entity as HealthSystem;
        return { 
          name: healthSystem.name, 
          type: 'Health System' 
        };
      }
    }
    
    // Handle the original result types
    if ('attendee' in result) {
      return { 
        name: `${result.attendee.first_name} ${result.attendee.last_name}`, 
        type: 'Attendee' 
      };
    } else if ('conference' in result) {
      return { 
        name: result.conference.name, 
        type: 'Conference' 
      };
    } else if ('healthSystem' in result) {
      return { 
        name: result.healthSystem.name, 
        type: 'Health System' 
      };
    }
    
    return { name: 'Unknown', type: 'Entity' };
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
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
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                    <CheckCircleIcon className="h-6 w-6 text-green-600" aria-hidden="true" />
                  </div>
                  <div className="mt-3 text-center sm:mt-5">
                    <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900">
                      Delete Results
                    </Dialog.Title>
                    <div className="mt-4">
                      <div className="overflow-hidden bg-white shadow sm:rounded-md">
                        <ul role="list" className="divide-y divide-gray-200">
                          {results.map((result, index) => {
                            const { name, type } = getEntityInfo(result);
                            
                            return (
                              <li key={index}>
                                <div className="flex items-center px-4 py-4 sm:px-6">
                                  <div className="flex min-w-0 flex-1 items-center">
                                    <div className="flex-shrink-0">
                                      {result.success ? (
                                        <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                                          <CheckCircleIcon className="h-5 w-5 text-green-600" aria-hidden="true" />
                                        </div>
                                      ) : (
                                        <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                                          <XCircleIcon className="h-5 w-5 text-red-600" aria-hidden="true" />
                                        </div>
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1 px-4">
                                      <p className="truncate text-sm font-medium text-gray-900">{name}</p>
                                      <p className="text-xs text-gray-500">{type}</p>
                                    </div>
                                    <div>
                                      <p className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {result.success ? 'Success' : 'Failed'}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                                {!result.success && result.error && (
                                  <div className="px-4 pb-4 sm:px-6">
                                    <div className="mt-1 text-sm text-red-600 bg-red-50 p-2 rounded">
                                      {result.error}
                                    </div>
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-5 sm:mt-6">
                  <button
                    type="button"
                    className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    onClick={onClose}
                  >
                    Close
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
} 