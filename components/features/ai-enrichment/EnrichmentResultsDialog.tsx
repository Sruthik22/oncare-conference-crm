import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import type { Attendee } from '@/types'

interface EnrichmentResult {
  attendee: Attendee
  success: boolean
  error?: string
}

interface EnrichmentResultsDialogProps {
  isOpen: boolean
  onClose: () => void
  results: EnrichmentResult[]
}

export function EnrichmentResultsDialog({ isOpen, onClose, results }: EnrichmentResultsDialogProps) {
  const successfulResults = results.filter(result => result.success)
  const failedResults = results.filter(result => !result.success)
  const totalCount = results.length
  const successCount = successfulResults.length
  const failedCount = failedResults.length

  return (
    <div className={`fixed inset-0 z-[9999] ${isOpen ? 'block' : 'hidden'}`}>
      <div className="fixed inset-0 bg-black bg-opacity-30" onClick={onClose} />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl flex flex-col h-[80vh] max-h-[600px]">
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-center mb-4">
              <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
                <CheckCircleIcon className="h-6 w-6 text-blue-600" aria-hidden="true" />
              </div>
            </div>
            
            <h3 className="text-lg font-medium leading-6 text-gray-900 text-center mb-4">
              Enrichment Complete
            </h3>
            
            {/* Summary Stats using Tailwind metrics component */}
            <dl className="grid grid-cols-3 gap-x-8 text-center">
              <div className="mx-auto flex max-w-xs flex-col gap-y-2">
                <dt className="text-base text-gray-600">Total Attempted</dt>
                <dd className="order-first text-3xl font-semibold tracking-tight text-gray-900">
                  {totalCount}
                </dd>
              </div>
              <div className="mx-auto flex max-w-xs flex-col gap-y-2">
                <dt className="text-base text-gray-600">Successfully Enriched</dt>
                <dd className="order-first text-3xl font-semibold tracking-tight text-green-600">
                  {successCount}
                </dd>
              </div>
              <div className="mx-auto flex max-w-xs flex-col gap-y-2">
                <dt className="text-base text-gray-600">Failed to Enrich</dt>
                <dd className="order-first text-3xl font-semibold tracking-tight text-red-600">
                  {failedCount}
                </dd>
              </div>
            </dl>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              {/* All results combined in one scrollable list */}
              {results.map((result, index) => (
                <div 
                  key={index} 
                  className={`p-3 rounded-lg border ${
                    result.success 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-start">
                    {result.success ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-600 mr-3 mt-1 flex-shrink-0" />
                    ) : (
                      <XCircleIcon className="h-5 w-5 text-red-600 mr-3 mt-1 flex-shrink-0" />
                    )}
                    
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className={`text-sm font-medium ${
                          result.success ? 'text-green-800' : 'text-red-800'
                        }`}>
                          {result.attendee.first_name} {result.attendee.last_name}
                        </h4>
                        <span className="text-xs text-gray-500">
                          {result.success ? 'Enriched' : 'Failed'}
                        </span>
                      </div>
                      
                      {result.attendee.company && (
                        <p className="text-sm text-gray-600">
                          {result.attendee.company}
                        </p>
                      )}
                      
                      {result.attendee.title && (
                        <p className="text-xs text-gray-500">
                          {result.attendee.title}
                        </p>
                      )}
                      
                      {result.error && (
                        <p className="text-xs text-red-600 mt-1">
                          Error: {result.error}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer with action button */}
          <div className="border-t border-gray-200 p-4 flex justify-center">
            <button
              type="button"
              className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 