import { useSelection } from '@/lib/context/SelectionContext'
import { XMarkIcon, ArrowPathIcon, TrashIcon, ArrowUpTrayIcon, ArrowDownTrayIcon, TagIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'
import { apolloService, ApolloEnrichmentResponse, ApolloContactCreate } from '@/lib/apollo'
import type { Attendee } from '@/types'
import { EnrichmentResultsDialog } from './EnrichmentResultsDialog'
import ApolloListModal from './ApolloListModal'
import { PushToApolloResultsDialog } from './PushToApolloResultsDialog'
import { ListModal } from './ListModal'
import { AddToListResultsDialog } from './AddToListResultsDialog'
import { supabase } from '@/lib/supabase'

interface ActionBarProps {
  onEnrichmentComplete: (enrichedData: ApolloEnrichmentResponse) => void
  onDelete?: (selectedAttendees: Attendee[]) => void
  conferenceName?: string
  activeListId?: string | null
  onListDelete?: (listId: string) => void
  refreshLists?: () => Promise<void>
}

export function ActionBar({ 
  onEnrichmentComplete, 
  onDelete, 
  conferenceName = '',
  activeListId = null,
  onListDelete,
  refreshLists
}: ActionBarProps) {
  const { selectedItems, deselectAll } = useSelection()
  const [isEnriching, setIsEnriching] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeletingList, setIsDeletingList] = useState(false)
  const [isPushing, setIsPushing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isAddingToList, setIsAddingToList] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false)
  const [isListModalOpen, setIsListModalOpen] = useState(false)
  const [isAddToListModalOpen, setIsAddToListModalOpen] = useState(false)
  const [isPushResultsModalOpen, setIsPushResultsModalOpen] = useState(false)
  const [isAddToListResultsModalOpen, setIsAddToListResultsModalOpen] = useState(false)
  const [selectedListName, setSelectedListName] = useState('')
  const [enrichmentResults, setEnrichmentResults] = useState<Array<{
    attendee: Attendee
    success: boolean
    error?: string
  }>>([])
  const [pushResults, setPushResults] = useState<Array<{
    attendee: Attendee
    success: boolean
    error?: string
  }>>([])
  const [addToListResults, setAddToListResults] = useState<Array<{
    attendee: Attendee
    success: boolean
    error?: string
  }>>([])

  const handleExportCSV = () => {
    try {
      setIsExporting(true)
      setError(null)

      // Filter to only include attendees
      const selectedAttendees = selectedItems.filter((item): item is Attendee => 
        'first_name' in item && 'last_name' in item
      )
      
      if (selectedAttendees.length === 0) {
        setError('Please select at least one attendee')
        return
      }

      // Define CSV header
      const csvHeader = [
        'First Name', 
        'Last Name', 
        'Email', 
        'Phone', 
        'Title', 
        'Company', 
        'LinkedIn URL'
      ].join(',')
      
      // Convert attendees to CSV rows
      const csvRows = selectedAttendees.map(attendee => {
        // Ensure values are escaped properly for CSV
        const escapeCSV = (value: string | undefined) => {
          if (!value) return ''
          // Escape quotes and wrap in quotes if contains comma, quote or newline
          const needsQuotes = value.includes(',') || value.includes('"') || value.includes('\n')
          const escaped = value.replace(/"/g, '""')
          return needsQuotes ? `"${escaped}"` : escaped
        }
        
        return [
          escapeCSV(attendee.first_name),
          escapeCSV(attendee.last_name),
          escapeCSV(attendee.email),
          escapeCSV(attendee.phone),
          escapeCSV(attendee.title),
          escapeCSV(attendee.health_systems?.name || attendee.company),
          escapeCSV(attendee.linkedin_url)
        ].join(',')
      })
      
      // Combine header and rows
      const csvContent = [csvHeader, ...csvRows].join('\n')
      
      // Create a blob and download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', `${conferenceName || 'attendees'}_export_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

    } catch (err) {
      console.error('Export error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to export contacts'
      setError(errorMessage)
    } finally {
      setIsExporting(false)
    }
  }

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

  const handleBulkDelete = () => {
    try {
      setIsDeleting(true)
      setError(null)

      // Filter to only include attendees
      const selectedAttendees = selectedItems.filter((item): item is Attendee => 
        'first_name' in item && 'last_name' in item
      )
      
      if (selectedAttendees.length === 0) {
        setError('Please select at least one attendee')
        return
      }

      // Call the onDelete handler passed from parent
      if (onDelete) {
        onDelete(selectedAttendees)
      }
      
      // Clear selection after initiating deletion
      deselectAll()
    } catch (err) {
      console.error('Delete preparation error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to prepare contacts for deletion'
      setError(errorMessage)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleBulkPushToApollo = () => {
    setError(null)
    
    // Filter to only include attendees
    const selectedAttendees = selectedItems.filter((item): item is Attendee => 
      'first_name' in item && 'last_name' in item
    )
    
    if (selectedAttendees.length === 0) {
      setError('Please select at least one attendee')
      return
    }
    
    setIsListModalOpen(true)
  }

  const handleBulkAddToList = () => {
    setError(null)
    
    // Filter to only include attendees
    const selectedAttendees = selectedItems.filter((item): item is Attendee => 
      'first_name' in item && 'last_name' in item
    )
    
    if (selectedAttendees.length === 0) {
      setError('Please select at least one attendee')
      return
    }
    
    setIsAddToListModalOpen(true)
  }

  const handleListSelected = async (listName: string) => {
    setIsPushing(true)
    setError(null)
    setSelectedListName(listName)
    
    try {
      // Filter to only include attendees
      const selectedAttendees = selectedItems.filter((item): item is Attendee => 
        'first_name' in item && 'last_name' in item
      )
      
      if (selectedAttendees.length === 0) {
        throw new Error('No attendees selected')
      }

      // Convert attendees to Apollo contacts
      const contacts: ApolloContactCreate[] = selectedAttendees.map(attendee => ({
        firstName: attendee.first_name,
        lastName: attendee.last_name,
        name: `${attendee.first_name} ${attendee.last_name}`,
        email: attendee.email || '',
        title: attendee.title || '',
        organization: attendee.health_systems?.name || attendee.company || '',
        phone: attendee.phone || '',
        linkedinUrl: attendee.linkedin_url || '',
      }))

      // Push contacts to Apollo with the selected list name as the label
      await apolloService.pushContactsToApollo(contacts, listName)
      
      // All contacts were successfully pushed
      const results = selectedAttendees.map(attendee => ({
        attendee,
        success: true
      }))
      
      setPushResults(results)
      setIsPushResultsModalOpen(true)
      
      // Clear selection after successful push
      deselectAll()
    } catch (err) {
      console.error('Error pushing to Apollo:', err)
      
      // If we have attendees but the push failed, mark all as failed
      const selectedAttendees = selectedItems.filter((item): item is Attendee => 
        'first_name' in item && 'last_name' in item
      )
      
      if (selectedAttendees.length > 0) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to push contacts to Apollo'
        const results = selectedAttendees.map(attendee => ({
          attendee,
          success: false,
          error: errorMessage
        }))
        
        setPushResults(results)
        setIsPushResultsModalOpen(true)
      } else {
        setError(err instanceof Error ? err.message : 'Failed to push contacts to Apollo')
      }
    } finally {
      setIsPushing(false)
    }
  }
  
  const handleAddAttendeesList = async (listName: string) => {
    setIsAddingToList(true)
    setError(null)
    setSelectedListName(listName)
    
    try {
      // Filter to only include attendees
      const selectedAttendees = selectedItems.filter((item): item is Attendee => 
        'first_name' in item && 'last_name' in item
      )
      
      if (selectedAttendees.length === 0) {
        throw new Error('No attendees selected')
      }
      
      // Check if the list exists, if not create it
      let listId: string
      const { data: existingList, error: existingListError } = await supabase
        .from('lists')
        .select('id')
        .eq('name', listName)
        .single()
      
      if (existingListError || !existingList) {
        // Create a new list
        const { data: newList, error: newListError } = await supabase
          .from('lists')
          .insert({ name: listName })
          .select('id')
          .single()
        
        if (newListError || !newList) {
          throw new Error(newListError?.message || 'Failed to create list')
        }
        
        listId = newList.id
      } else {
        listId = existingList.id
      }
      
      // Track results for each attendee
      const results: Array<{
        attendee: Attendee
        success: boolean
        error?: string
      }> = []
      
      // Process all attendees and add them to the list
      for (const attendee of selectedAttendees) {
        try {
          // Check if this attendee is already in the list
          const { data: existingEntry, error: existingEntryError } = await supabase
            .from('attendee_lists')
            .select('id')
            .eq('attendee_id', attendee.id)
            .eq('list_id', listId)
            .single()
          
          if (!existingEntryError && existingEntry) {
            // Already in list, count as success
            results.push({
              attendee,
              success: true
            })
            continue
          }
          
          // Add attendee to the list
          const { error: insertError } = await supabase
            .from('attendee_lists')
            .insert({
              attendee_id: attendee.id,
              list_id: listId
            })
          
          if (insertError) {
            results.push({
              attendee,
              success: false,
              error: insertError.message
            })
          } else {
            results.push({
              attendee,
              success: true
            })
          }
        } catch (err) {
          results.push({
            attendee,
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error occurred'
          })
        }
      }
      
      // Set results and show dialog
      setAddToListResults(results)
      setIsAddToListResultsModalOpen(true)
      
      // First refresh the lists
      if (refreshLists) {
        await refreshLists();
      }
      
      // Clear selection after adding to list
      deselectAll()
    } catch (err) {
      console.error('Error adding to list:', err)
      setError(err instanceof Error ? err.message : 'Failed to add attendees to list')
    } finally {
      setIsAddingToList(false)
    }
  }

  const handleDeleteCurrentList = async () => {
    if (!activeListId || !onListDelete) return;

    if (isDeletingList || !confirm(`Are you sure you want to delete the list "${conferenceName}"? This action cannot be undone.`)) {
      return;
    }

    setIsDeletingList(true);
    try {
      onListDelete(activeListId);
    } catch (err) {
      console.error('Error deleting list:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete list');
    } finally {
      setIsDeletingList(false);
    }
  };

  if (selectedItems.length === 0) {
    return (
      <>
        <EnrichmentResultsDialog
          isOpen={isSuccessModalOpen}
          onClose={() => setIsSuccessModalOpen(false)}
          results={enrichmentResults}
        />
        <PushToApolloResultsDialog
          isOpen={isPushResultsModalOpen}
          onClose={() => setIsPushResultsModalOpen(false)}
          results={pushResults}
          listName={selectedListName}
        />
        <AddToListResultsDialog
          isOpen={isAddToListResultsModalOpen}
          onClose={() => setIsAddToListResultsModalOpen(false)}
          results={addToListResults}
          listName={selectedListName}
        />
      </>
    );
  }

  return (
    <>
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 p-2 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="font-medium">
              {selectedItems.length} selected
            </span>

            {selectedItems.length > 0 && (
              <button
                onClick={() => deselectAll()}
                className="inline-flex items-center text-gray-500 hover:text-gray-700"
              >
                <XMarkIcon className="h-4 w-4 mr-1" />
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {selectedItems.length > 0 && (
              <>
                <button 
                  onClick={handleBulkEnrich}
                  disabled={isEnriching || selectedItems.length === 0}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none"
                >
                  {isEnriching ? (
                    <span className="animate-spin mr-2">⌛</span>
                  ) : (
                    <ArrowPathIcon className="h-4 w-4 mr-2" />
                  )}
                  Enrich
                </button>

                <button 
                  onClick={handleExportCSV}
                  disabled={isExporting || selectedItems.length === 0}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none"
                >
                  {isExporting ? (
                    <span className="animate-spin mr-2">⌛</span>
                  ) : (
                    <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                  )}
                  Export to File
                </button>

                <button 
                  onClick={handleBulkPushToApollo}
                  disabled={isPushing || selectedItems.length === 0}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-purple-700 bg-purple-100 hover:bg-purple-200 focus:outline-none"
                >
                  {isPushing ? (
                    <span className="animate-spin mr-2">⌛</span>
                  ) : (
                    <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
                  )}
                  Push to Apollo
                </button>

                <button 
                  onClick={handleBulkAddToList}
                  disabled={isAddingToList || selectedItems.length === 0}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-yellow-700 bg-yellow-100 hover:bg-yellow-200 focus:outline-none"
                >
                  {isAddingToList ? (
                    <span className="animate-spin mr-2">⌛</span>
                  ) : (
                    <TagIcon className="h-4 w-4 mr-2" />
                  )}
                  Add to List
                </button>

                <button 
                  onClick={handleBulkDelete}
                  disabled={isDeleting || selectedItems.length === 0}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none"
                >
                  {isDeleting ? (
                    <span className="animate-spin mr-2">⌛</span>
                  ) : (
                    <TrashIcon className="h-4 w-4 mr-2" />
                  )}
                  Delete
                </button>
              </>
            )}
            
            {activeListId && onListDelete && (
              <button 
                onClick={handleDeleteCurrentList}
                disabled={isDeletingList}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none"
              >
                {isDeletingList ? (
                  <span className="animate-spin mr-2">⌛</span>
                ) : (
                  <TrashIcon className="h-4 w-4 mr-2" />
                )}
                Delete Current List
              </button>
            )}

            {error && (
              <div className="p-1.5 bg-red-50 text-red-700 rounded-md text-sm">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>

      <EnrichmentResultsDialog
        isOpen={isSuccessModalOpen}
        onClose={() => setIsSuccessModalOpen(false)}
        results={enrichmentResults}
      />
      
      <ApolloListModal
        isOpen={isListModalOpen}
        onClose={() => setIsListModalOpen(false)}
        onListSelected={handleListSelected}
        defaultListName={conferenceName}
      />
      
      <ListModal
        isOpen={isAddToListModalOpen}
        onClose={() => setIsAddToListModalOpen(false)}
        onListSelected={handleAddAttendeesList}
        defaultListName={conferenceName}
        refreshLists={refreshLists}
      />
      
      <PushToApolloResultsDialog
        isOpen={isPushResultsModalOpen}
        onClose={() => setIsPushResultsModalOpen(false)}
        results={pushResults}
        listName={selectedListName}
      />
      
      <AddToListResultsDialog
        isOpen={isAddToListResultsModalOpen}
        onClose={() => setIsAddToListResultsModalOpen(false)}
        results={addToListResults}
        listName={selectedListName}
      />
    </>
  )
} 