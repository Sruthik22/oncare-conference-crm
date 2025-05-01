import { useSelection } from '@/lib/context/SelectionContext'
import { XMarkIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'
import { apolloService, ApolloEnrichmentResponse } from '@/lib/apollo'
import type { Attendee } from '@/types'
import { EnrichmentResultsDialog } from './EnrichmentResultsDialog'

interface ActionBarProps {
  onEnrichmentComplete: (enrichedData: ApolloEnrichmentResponse) => void
}

export function ActionBar({ onEnrichmentComplete }: ActionBarProps) {
  const { selectedItems, deselectAll } = useSelection()
  const [isEnriching, setIsEnriching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false)
  const [enrichmentResults, setEnrichmentResults] = useState<Array<{
    attendee: Attendee
    success: boolean
    error?: string
  }>>([])

  const handleBulkEnrich = async () => {
    try {
      setIsEnriching(true)
      setError(null)

      // Filter to only include attendees
      const selectedAttendees = selectedItems.filter((item): item is Attendee => 
        'first_name' in item && 'last_name' in item
      )
      
      if (selectedAttendees.length === 0) {
        setError('Please select at least one attendee')
        return
      }

      // Prepare the data for Apollo API
      const details = selectedAttendees.map((attendee: Attendee) => ({
        firstName: attendee.first_name,
        lastName: attendee.last_name,
        organization: attendee.company || '',
        title: attendee.title || '',
      }))

      // Call Apollo service to enrich contacts
      const enrichedData = await apolloService.enrichContacts(details)
      
      // Process results
      const results = selectedAttendees.map(attendee => {
        const match = enrichedData?.matches?.find(match => 
          match.first_name?.toLowerCase() === attendee.first_name.toLowerCase() &&
          match.last_name?.toLowerCase() === attendee.last_name.toLowerCase()
        )
        
        return {
          attendee,
          success: !!match,
          error: match ? undefined : 'No matching data found'
        }
      })
      
      setEnrichmentResults(results)
      setIsSuccessModalOpen(true)
      
      // Clear selection after successful enrichment
      deselectAll()
      
      // Call the completion handler in the background
      Promise.resolve(onEnrichmentComplete(enrichedData)).catch((err: Error) => {
        console.error('Background enrichment update failed:', err);
      })
    } catch (err) {
      console.error('Enrichment error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to enrich contacts'
      setError(errorMessage)
    } finally {
      setIsEnriching(false)
    }
  }

  if (selectedItems.length === 0) {
    return (
      <EnrichmentResultsDialog
        isOpen={isSuccessModalOpen}
        onClose={() => setIsSuccessModalOpen(false)}
        results={enrichmentResults}
      />
    );
  }

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg p-4 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-700">
              {selectedItems.length} {selectedItems.length === 1 ? 'item' : 'items'} selected
            </span>
            <button
              onClick={deselectAll}
              className="text-gray-500 hover:text-gray-700"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="flex items-center space-x-4">
            {error && (
              <span className="text-sm text-red-600">{error}</span>
            )}
            <button
              onClick={handleBulkEnrich}
              disabled={isEnriching}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isEnriching ? (
                <>
                  <ArrowPathIcon className="animate-spin -ml-1 mr-2 h-5 w-5" />
                  Enriching...
                </>
              ) : (
                'Enrich with Apollo'
              )}
            </button>
            <button
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Export
            </button>
            <button
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Add to List
            </button>
          </div>
        </div>
      </div>

      <EnrichmentResultsDialog
        isOpen={isSuccessModalOpen}
        onClose={() => setIsSuccessModalOpen(false)}
        results={enrichmentResults}
      />
    </>
  )
} 