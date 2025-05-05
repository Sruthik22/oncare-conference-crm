import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { CheckCircleIcon, XCircleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { AIEnrichmentResult } from '@/lib/ai'

interface AIEnrichmentResultsDialogProps {
  isOpen: boolean
  onClose: () => void
  results: AIEnrichmentResult[]
  columnName: string
}

export function AIEnrichmentResultsDialog({ isOpen, onClose, results, columnName }: AIEnrichmentResultsDialogProps) {
  // Calculate success rate
  const successCount = results.filter(result => result.success).length
  const successRate = results.length > 0 ? Math.round((successCount / results.length) * 100) : 0
  
  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6">
                <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
                  <button
                    type="button"
                    className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    onClick={onClose}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                    <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900">
                      AI Enrichment Results
                    </Dialog.Title>
                    
                    <div className="mt-4 bg-green-50 p-4 rounded-md">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <CheckCircleIcon className="h-5 w-5 text-green-400" aria-hidden="true" />
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-green-800">
                            {successCount} of {results.length} items were successfully enriched ({successRate}%)
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-500">Details</h4>
                      <ul className="mt-2 divide-y divide-gray-200 max-h-96 overflow-y-auto">
                        {results.map((result, index) => (
                          <li key={index} className="py-3">
                            <div className="flex items-start">
                              <div className="flex-shrink-0 mt-0.5">
                                {result.success ? (
                                  <CheckCircleIcon className="h-5 w-5 text-green-500" />
                                ) : (
                                  <XCircleIcon className="h-5 w-5 text-red-500" />
                                )}
                              </div>
                              <div className="ml-3 flex-grow">
                                <p className="text-sm font-medium text-gray-900">
                                  {result.item.name || (result.item.first_name && `${result.item.first_name} ${result.item.last_name}`) || 'Item'}
                                </p>
                                {result.success ? (
                                  <div className="mt-1 text-sm text-gray-500">
                                    <p>
                                      <span className="font-medium">{columnName}:</span>{' '}
                                      {typeof result.enrichedData?.[columnName] === 'boolean'
                                        ? (result.enrichedData[columnName] ? 'Yes' : 'No')
                                        : String(result.enrichedData?.[columnName] || 'N/A')}
                                    </p>
                                  </div>
                                ) : (
                                  <p className="mt-1 text-sm text-red-500">
                                    {result.error || 'Failed to enrich'}
                                  </p>
                                )}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 sm:ml-3 sm:w-auto"
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