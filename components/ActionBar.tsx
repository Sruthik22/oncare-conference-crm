import { useSelection } from '@/lib/context/SelectionContext'
import { XMarkIcon, ArrowPathIcon, TrashIcon, ArrowUpTrayIcon, ArrowDownTrayIcon, TagIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { useState, useEffect } from 'react'
import { apolloService, ApolloEnrichmentResponse, ApolloContactCreate } from '@/lib/apollo'
import { definitiveService, DefinitiveEnrichmentResult } from '@/lib/definitive'
import { AIEnrichmentResult, ensureColumnExists } from '@/lib/ai'
import type { Attendee, HealthSystem, Conference } from '@/types'
import { EnrichmentResultsDialog } from './EnrichmentResultsDialog'
import { DefinitiveEnrichmentResultsDialog } from './DefinitiveEnrichmentResultsDialog'
import { AIEnrichmentDialog } from './AIEnrichmentDialog'
import { AIEnrichmentResultsDialog } from './AIEnrichmentResultsDialog'
import ApolloListModal from './ApolloListModal'
import { PushToApolloResultsDialog } from './PushToApolloResultsDialog'
import { ListModal } from './ListModal'
import { AddToListResultsDialog } from './AddToListResultsDialog'
import { supabase } from '@/lib/supabase'
import type { ColumnDef } from '@tanstack/react-table'
import { IconName } from '@/hooks/useColumnManagement'

interface ActionBarProps {
  onEnrichmentComplete: (enrichedData: ApolloEnrichmentResponse) => void
  onDefinitiveEnrichmentComplete?: (enrichedData: any) => void
  onAIEnrichmentComplete?: (enrichedData: any) => void
  onDelete?: (selectedItems: Array<Attendee | HealthSystem | Conference>) => void
  conferenceName?: string
  activeListId?: string | null
  onListDelete?: (listId: string) => void
  refreshLists?: () => Promise<void>
  allColumns?: ColumnDef<Attendee | HealthSystem | Conference>[]
  isLoading?: boolean
  activeTab?: 'attendees' | 'health-systems' | 'conferences'
  getFieldsForAllColumns: (item: Attendee | HealthSystem | Conference) => { id: string, label: string, value: string, iconName: IconName }[]
}

export function ActionBar({ 
  onEnrichmentComplete, 
  onDefinitiveEnrichmentComplete,
  onAIEnrichmentComplete,
  onDelete, 
  conferenceName = '',
  activeListId = null,
  onListDelete,
  refreshLists,
  allColumns = [],
  isLoading = false,
  activeTab = 'attendees',
  getFieldsForAllColumns
}: ActionBarProps) {
  const { selectedItems, deselectAll } = useSelection()
  const [isEnriching, setIsEnriching] = useState(false)
  const [isDefinitiveEnriching, setIsDefinitiveEnriching] = useState(false)
  const [isAIEnriching] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeletingList, setIsDeletingList] = useState(false)
  const [isPushing, setIsPushing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isAddingToList, setIsAddingToList] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false)
  const [isDefinitiveSuccessModalOpen, setIsDefinitiveSuccessModalOpen] = useState(false)
  const [isAIEnrichmentModalOpen, setIsAIEnrichmentModalOpen] = useState(false)
  const [isAISuccessModalOpen, setIsAISuccessModalOpen] = useState(false)
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
  const [definitiveEnrichmentResults, setDefinitiveEnrichmentResults] = useState<DefinitiveEnrichmentResult[]>([])
  const [aiEnrichmentResults, setAIEnrichmentResults] = useState<AIEnrichmentResult[]>([])
  const [aiEnrichmentColumnName, setAIEnrichmentColumnName] = useState('')
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

  // Clear error message when selection changes
  useEffect(() => {
    setError(null);
  }, [selectedItems]);

  // Helper functions to determine the type of selected items
  const getSelectedAttendees = () => selectedItems.filter((item): item is Attendee => 
    'first_name' in item && 'last_name' in item
  )
  
  const getSelectedHealthSystems = () => selectedItems.filter((item): item is HealthSystem => 
    'name' in item && !('first_name' in item) && !('start_date' in item)
  )
  
  const getSelectedConferences = () => selectedItems.filter((item): item is Conference => 
    'name' in item && 'start_date' in item
  )
  
  // Check if we have specific types of items selected
  const hasAttendees = getSelectedAttendees().length > 0
  const hasHealthSystems = getSelectedHealthSystems().length > 0
  const hasConferences = getSelectedConferences().length > 0
  
  // Check if we have mixed selections (which we'll disallow for most operations)
  const hasMixedSelection = (hasAttendees ? 1 : 0) + (hasHealthSystems ? 1 : 0) + (hasConferences ? 1 : 0) > 1

  const handleExportCSV = async () => {
    try {
      setIsExporting(true)
      setError(null)

      if (hasMixedSelection) {
        setError('Please select only one type of item (attendees, health systems, or conferences)')
        return
      }
      
      // Generic function to escape CSV values
      const escapeCSV = (value: any) => {
        if (value === null || value === undefined) return ''
        
        // Handle array values
        if (Array.isArray(value)) {
          return escapeCSV(value.join('; '))
        }
        
        // Convert to string if it's not already
        const stringValue = typeof value === 'string' ? value : String(value)
        // Escape quotes and wrap in quotes if contains comma, quote or newline
        const needsQuotes = stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')
        const escaped = stringValue.replace(/"/g, '""')
        return needsQuotes ? `"${escaped}"` : escaped
      }
      
      if (hasAttendees) {
        const selectedAttendees = getSelectedAttendees()
        
        // Get all fields for the first attendee to determine columns
        const firstItemFields = getFieldsForAllColumns(selectedAttendees[0])
        
        // Create CSV header from field labels
        const csvHeader = firstItemFields.map((field: { label: string }) => field.label).join(',')
        
        // Create CSV rows for each attendee
        const csvRows = selectedAttendees.map(attendee => {
          const fields = getFieldsForAllColumns(attendee)
          return fields.map((field: { value: string }) => escapeCSV(field.value)).join(',')
        })
        
        // Combine header and rows
        const csvContent = [csvHeader, ...csvRows].join('\n')
        
        // Create and trigger download
        downloadCSV(csvContent, `${conferenceName || 'attendees'}_export`)
      } else if (hasHealthSystems) {
        const selectedHealthSystems = getSelectedHealthSystems()
        
        // Get all fields for the first health system to determine columns
        const firstItemFields = getFieldsForAllColumns(selectedHealthSystems[0])
        
        // Create CSV header from field labels
        const csvHeader = firstItemFields.map((field: { label: string }) => field.label).join(',')
        
        // Create CSV rows for each health system
        const csvRows = selectedHealthSystems.map(healthSystem => {
          const fields = getFieldsForAllColumns(healthSystem)
          return fields.map((field: { value: string }) => escapeCSV(field.value)).join(',')
        })
        
        // Combine header and rows
        const csvContent = [csvHeader, ...csvRows].join('\n')
        
        // Create and trigger download
        downloadCSV(csvContent, `health_systems_export`)
      } else if (hasConferences) {
        const selectedConferences = getSelectedConferences()
        
        // Get all fields for the first conference to determine columns
        const firstItemFields = getFieldsForAllColumns(selectedConferences[0])
        
        // Create CSV header from field labels
        const csvHeader = firstItemFields.map((field: { label: string }) => field.label).join(',')
        
        // Create CSV rows for each conference
        const csvRows = selectedConferences.map(conference => {
          const fields = getFieldsForAllColumns(conference)
          return fields.map((field: { value: string }) => escapeCSV(field.value)).join(',')
        })
        
        // Combine header and rows
        const csvContent = [csvHeader, ...csvRows].join('\n')
        
        // Create and trigger download
        downloadCSV(csvContent, `conferences_export`)
      } else {
        setError('Please select at least one item to export')
      }
    } catch (err) {
      console.error('Export error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to export data'
      setError(errorMessage)
    } finally {
      setIsExporting(false)
    }
  }

  // Helper function to download CSV
  const downloadCSV = (csvContent: string, fileNamePrefix: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `${fileNamePrefix}_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleBulkEnrich = async () => {
    try {
      setIsEnriching(true)
      setError(null)

      if (!hasAttendees || hasMixedSelection) {
        setError('Please select only attendees for enrichment')
        return
      }

      const selectedAttendees = getSelectedAttendees()
      
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

  const handleBulkDefinitiveEnrich = async () => {
    try {
      setIsDefinitiveEnriching(true)
      setError(null)

      if (!hasHealthSystems || hasMixedSelection) {
        setError('Please select only health systems for Definitive enrichment')
        return
      }

      const selectedHealthSystems = getSelectedHealthSystems()
      
      if (selectedHealthSystems.length === 0) {
        setError('Please select at least one health system')
        return
      }

      // Call Definitive service to enrich health systems
      const enrichedData = await definitiveService.enrichHealthSystems(selectedHealthSystems)
      
      // Store the results
      setDefinitiveEnrichmentResults(enrichedData)
      setIsDefinitiveSuccessModalOpen(true)
      
      // Clear selection after successful enrichment
      deselectAll()
      
      // Update health systems in the database with the enriched data
      const successfullyEnriched = enrichedData.filter(result => result.success)
      
      if (successfullyEnriched.length > 0 && onDefinitiveEnrichmentComplete) {
        try {
          // For each successfully enriched health system, update it in the database
          for (const result of successfullyEnriched) {
            const { healthSystem } = result
            
            // Update the health system in Supabase
            await supabase
              .from('health_systems')
              .update({
                definitive_id: healthSystem.definitive_id,
                website: healthSystem.website,
                address: healthSystem.address,
                city: healthSystem.city,
                state: healthSystem.state,
                zip: healthSystem.zip
              })
              .eq('id', healthSystem.id)
          }
          
          // Call the completion handler
          if (onDefinitiveEnrichmentComplete) {
            onDefinitiveEnrichmentComplete(enrichedData)
          }
        } catch (updateError) {
          console.error('Error updating health systems:', updateError)
        }
      }
    } catch (err) {
      console.error('Definitive enrichment error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to enrich health systems'
      setError(errorMessage)
    } finally {
      setIsDefinitiveEnriching(false)
    }
  }

  const handleBulkAIEnrich = () => {
    try {
      setError(null)

      if (selectedItems.length === 0) {
        setError('Please select at least one item')
        return
      }

      // Open the AI enrichment dialog
      setIsAIEnrichmentModalOpen(true)
    } catch (err) {
      console.error('AI enrichment preparation error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to prepare items for AI enrichment'
      setError(errorMessage)
    }
  }

  const handleAIEnrichmentComplete = async (results: AIEnrichmentResult[], columnName: string) => {
    try {
      setAIEnrichmentResults(results)
      setAIEnrichmentColumnName(columnName)
      setIsAISuccessModalOpen(true)
      
      // Clear selection after successful enrichment
      deselectAll()
      
      // Update items in the database with the enriched data
      const successfullyEnriched = results.filter(result => result.success)
      
      if (successfullyEnriched.length > 0) {
        try {
          // Group by item type
          const attendeeItems = successfullyEnriched.filter(result => 'first_name' in result.item && 'last_name' in result.item)
          const healthSystemItems = successfullyEnriched.filter(result => 'name' in result.item && !('first_name' in result.item) && !('start_date' in result.item))
          const conferenceItems = successfullyEnriched.filter(result => 'name' in result.item && 'start_date' in result.item)
          
          // Determine column type based on the first successful result
          let columnType = 'text'
          if (successfullyEnriched.length > 0) {
            const firstValue = successfullyEnriched[0].enrichedData[columnName]
            if (typeof firstValue === 'boolean') {
              columnType = 'boolean'
            } else if (typeof firstValue === 'number') {
              columnType = 'number'
            }
          }
          
          // Log diagnostics
          console.log('AI Enrichment results:', {
            total: results.length,
            successful: successfullyEnriched.length,
            attendees: attendeeItems.length,
            healthSystems: healthSystemItems.length,
            conferences: conferenceItems.length,
            columnName,
            columnType
          });
          
          // Process attendees
          if (attendeeItems.length > 0) {
            // First ensure the column exists in the attendees table
            const columnCreated = await ensureColumnExists('attendees', columnName, columnType)
            console.log(`Column creation for attendees ${columnCreated ? 'succeeded' : 'failed'}`);
            
            if (columnCreated) {
              // Now update each attendee
              for (const result of attendeeItems) {
                const { item, enrichedData } = result
                
                try {
                  // Update the attendee in Supabase
                  const { error } = await supabase
                    .from('attendees')
                    .update({ [columnName]: enrichedData[columnName] })
                    .eq('id', item.id)
                  
                  if (error) {
                    console.error(`Error updating attendee ${item.id}:`, error);
                  }
                } catch (updateErr) {
                  console.error(`Error updating attendee ${item.id}:`, updateErr);
                }
              }
            }
          }
          
          // Process health systems
          if (healthSystemItems.length > 0) {
            // First ensure the column exists in the health_systems table
            const columnCreated = await ensureColumnExists('health_systems', columnName, columnType)
            console.log(`Column creation for health_systems ${columnCreated ? 'succeeded' : 'failed'}`);
            
            if (columnCreated) {
              // Now update each health system
              for (const result of healthSystemItems) {
                const { item, enrichedData } = result
                
                try {
                  // Update the health system in Supabase
                  const { error } = await supabase
                    .from('health_systems')
                    .update({ [columnName]: enrichedData[columnName] })
                    .eq('id', item.id)
                  
                  if (error) {
                    console.error(`Error updating health system ${item.id}:`, error);
                  }
                } catch (updateErr) {
                  console.error(`Error updating health system ${item.id}:`, updateErr);
                }
              }
            }
          }
          
          // Process conferences
          if (conferenceItems.length > 0) {
            // First ensure the column exists in the conferences table
            const columnCreated = await ensureColumnExists('conferences', columnName, columnType)
            console.log(`Column creation for conferences ${columnCreated ? 'succeeded' : 'failed'}`);
            
            if (columnCreated) {
              // Now update each conference
              for (const result of conferenceItems) {
                const { item, enrichedData } = result
                
                try {
                  // Update the conference in Supabase
                  const { error } = await supabase
                    .from('conferences')
                    .update({ [columnName]: enrichedData[columnName] })
                    .eq('id', item.id)
                  
                  if (error) {
                    console.error(`Error updating conference ${item.id}:`, error);
                  }
                } catch (updateErr) {
                  console.error(`Error updating conference ${item.id}:`, updateErr);
                }
              }
            }
          }
          
          // Call the completion handler if provided
          if (onAIEnrichmentComplete) {
            onAIEnrichmentComplete(results)
          }
        } catch (updateError) {
          console.error('Error updating items with AI enrichment:', updateError)
        }
      }
    } catch (error) {
      console.error('Error in handleAIEnrichmentComplete:', error);
    }
  }

  const handleBulkDelete = () => {
    try {
      setIsDeleting(true)
      setError(null)

      if (selectedItems.length === 0) {
        setError('Please select at least one item')
        return
      }

      // Call the onDelete handler passed from parent
      if (onDelete) {
        onDelete(selectedItems)
      }
      
      // Clear selection after initiating deletion
      deselectAll()
    } catch (err) {
      console.error('Delete preparation error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to prepare items for deletion'
      setError(errorMessage)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleBulkPushToApollo = () => {
    setError(null)
    
    if (!hasAttendees || hasMixedSelection) {
      setError('Please select only attendees to push to Apollo')
      return
    }
    
    const selectedAttendees = getSelectedAttendees()
    
    if (selectedAttendees.length === 0) {
      setError('Please select at least one attendee')
      return
    }
    
    setIsListModalOpen(true)
  }

  const handleBulkAddToList = () => {
    setError(null)
    
    if (!hasAttendees || hasMixedSelection) {
      setError('Please select only attendees to add to a list')
      return
    }
    
    const selectedAttendees = getSelectedAttendees()
    
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
      if (!hasAttendees || hasMixedSelection) {
        throw new Error('Please select only attendees to push to Apollo')
      }
      
      const selectedAttendees = getSelectedAttendees()
      
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
      const selectedAttendees = getSelectedAttendees()
      
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
      if (!hasAttendees || hasMixedSelection) {
        throw new Error('Please select only attendees to add to a list')
      }
      
      const selectedAttendees = getSelectedAttendees()
      
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
        <DefinitiveEnrichmentResultsDialog
          isOpen={isDefinitiveSuccessModalOpen}
          onClose={() => setIsDefinitiveSuccessModalOpen(false)}
          results={definitiveEnrichmentResults}
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
                {/* Show enrich button only for attendees */}
                {hasAttendees && !hasMixedSelection && (
                  <button 
                    onClick={handleBulkEnrich}
                    disabled={isEnriching}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none"
                  >
                    {isEnriching ? (
                      <span className="animate-spin mr-2">⌛</span>
                    ) : (
                      <ArrowPathIcon className="h-4 w-4 mr-2" />
                    )}
                    Enrich with Apollo
                  </button>
                )}

                {/* Show Definitive Healthcare enrich button only for health systems */}
                {hasHealthSystems && !hasMixedSelection && (
                  <button 
                    onClick={handleBulkDefinitiveEnrich}
                    disabled={isDefinitiveEnriching}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none"
                  >
                    {isDefinitiveEnriching ? (
                      <span className="animate-spin mr-2">⌛</span>
                    ) : (
                      <ArrowPathIcon className="h-4 w-4 mr-2" />
                    )}
                    Enrich with Definitive
                  </button>
                )}

                {/* AI Enrichment button for all item types */}
                <button 
                  onClick={handleBulkAIEnrich}
                  disabled={isAIEnriching}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-purple-700 bg-purple-100 hover:bg-purple-200 focus:outline-none"
                >
                  {isAIEnriching ? (
                    <span className="animate-spin mr-2">⌛</span>
                  ) : (
                    <SparklesIcon className="h-4 w-4 mr-2" />
                  )}
                  Enrich with AI
                </button>

                {/* Export available for all types */}
                <button 
                  onClick={handleExportCSV}
                  disabled={isExporting}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none"
                >
                  {isExporting ? (
                    <span className="animate-spin mr-2">⌛</span>
                  ) : (
                    <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                  )}
                  Export to File
                </button>

                {/* Push to Apollo only for attendees */}
                {hasAttendees && !hasMixedSelection && (
                  <button 
                    onClick={handleBulkPushToApollo}
                    disabled={isPushing}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-purple-700 bg-purple-100 hover:bg-purple-200 focus:outline-none"
                  >
                    {isPushing ? (
                      <span className="animate-spin mr-2">⌛</span>
                    ) : (
                      <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
                    )}
                    Push to Apollo
                  </button>
                )}

                {/* Add to List only for attendees */}
                {hasAttendees && !hasMixedSelection && (
                  <button 
                    onClick={handleBulkAddToList}
                    disabled={isAddingToList}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-yellow-700 bg-yellow-100 hover:bg-yellow-200 focus:outline-none"
                  >
                    {isAddingToList ? (
                      <span className="animate-spin mr-2">⌛</span>
                    ) : (
                      <TagIcon className="h-4 w-4 mr-2" />
                    )}
                    Add to List
                  </button>
                )}

                {/* Delete available for all types */}
                <button 
                  onClick={handleBulkDelete}
                  disabled={isDeleting}
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
      
      <DefinitiveEnrichmentResultsDialog
        isOpen={isDefinitiveSuccessModalOpen}
        onClose={() => setIsDefinitiveSuccessModalOpen(false)}
        results={definitiveEnrichmentResults}
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

      <AIEnrichmentDialog
        isOpen={isAIEnrichmentModalOpen}
        onClose={() => setIsAIEnrichmentModalOpen(false)}
        items={selectedItems}
        onEnrichmentComplete={(results, columnName) => handleAIEnrichmentComplete(results, columnName)}
        allColumns={allColumns}
      />
      
      <AIEnrichmentResultsDialog
        isOpen={isAISuccessModalOpen}
        onClose={() => setIsAISuccessModalOpen(false)}
        results={aiEnrichmentResults}
        columnName={aiEnrichmentColumnName}
      />
    </>
  )
} 