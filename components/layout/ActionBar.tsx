import { useSelection } from '@/lib/context/SelectionContext'
import { XMarkIcon, ArrowPathIcon, TrashIcon, ArrowUpTrayIcon, ArrowDownTrayIcon, TagIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { useState, useEffect } from 'react'
import { apolloService, ApolloEnrichmentResponse, ApolloContactCreate } from '@/lib/apollo'
import { definitiveService, DefinitiveEnrichmentResult } from '@/lib/definitive'
import { AIEnrichmentResult, ensureColumnExists } from '@/lib/ai'
import type { Attendee, HealthSystem, Conference } from '@/types'
import { EnrichmentResultsDialog } from '@/components/features/ai-enrichment/EnrichmentResultsDialog'
import { DefinitiveEnrichmentResultsDialog } from '@/components/features/ai-enrichment/DefinitiveEnrichmentResultsDialog'
import { AIEnrichmentDialog } from '@/components/features/ai-enrichment/AIEnrichmentDialog'
import { AIEnrichmentResultsDialog } from '@/components/features/ai-enrichment/AIEnrichmentResultsDialog'
import ApolloListModal from '@/components/features/apollo/ApolloListModal'
import { PushToApolloResultsDialog } from '@/components/features/ai-enrichment/PushToApolloResultsDialog'
import { ListModal } from '@/components/features/lists/ListModal'
import { AddToListResultsDialog } from '@/components/features/ai-enrichment/AddToListResultsDialog'
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
  getFieldsForAllColumns: (item: Attendee | HealthSystem | Conference) => { id: string, label: string, value: string, iconName: IconName }[]
  isSelectingAll?: boolean
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
  getFieldsForAllColumns,
  isSelectingAll = false
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
  const [aiEnrichmentItems, setAiEnrichmentItems] = useState<Array<Attendee | HealthSystem | Conference>>([])
  const [processedAttendeesForList, setProcessedAttendeesForList] = useState<Attendee[]>([])

  // Clear error message when selection changes
  useEffect(() => {
    setError(null);
  }, [selectedItems]);

  // Centralized helper function to load real data for placeholder items
  const loadRealDataForItems = async (
    items: Array<Attendee | HealthSystem | Conference>,
    progressCallback?: (message: string) => void
  ): Promise<Array<Attendee | HealthSystem | Conference>> => {
    // Separate items by type
    const attendeeItems = items.filter((item): item is Attendee => 
      'first_name' in item && 'last_name' in item
    )
    const healthSystemItems = items.filter((item): item is HealthSystem => 
      'name' in item && !('first_name' in item) && !('start_date' in item)
    )
    const conferenceItems = items.filter((item): item is Conference => 
      'name' in item && 'start_date' in item
    )

    let processedItems = [...items]
    const BATCH_SIZE = 50

    // Helper function to process each entity type
    const processEntityType = async (
      entityItems: any[],
      tableName: string,
      placeholderCheck: (item: any) => boolean,
      entityTypeName: string
    ) => {
      if (entityItems.length === 0) return

      const hasPlaceholders = entityItems.some(placeholderCheck)
      if (!hasPlaceholders) return

      for (let i = 0; i < entityItems.length; i += BATCH_SIZE) {
        const batchItems = entityItems.slice(i, i + BATCH_SIZE)
        const itemsToLoad = batchItems.filter(placeholderCheck)
        
        if (itemsToLoad.length > 0) {
          progressCallback?.(
            `Loading ${entityTypeName} data - batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(entityItems.length/BATCH_SIZE)}`
          )
          
          const idsToLoad = itemsToLoad.map(item => item.id).filter(id => id)
          
          if (idsToLoad.length > 0) {
            const { data, error } = await supabase
              .from(tableName)
              .select('*')
              .in('id', idsToLoad)
              
            if (error) throw error
            
            if (data && data.length > 0) {
              data.forEach(realItem => {
                const index = processedItems.findIndex(item => item.id === realItem.id)
                if (index >= 0) {
                  processedItems[index] = realItem
                }
              })
            }
          }
        }
        
        if (i + BATCH_SIZE < entityItems.length) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
    }

    // Process each entity type
    await processEntityType(
      attendeeItems,
      'attendees',
      (item: Attendee) => item.first_name === '[LOADING]' || item.last_name === '[LOADING]',
      'attendee'
    )

    await processEntityType(
      healthSystemItems,
      'health_systems',
      (item: HealthSystem) => item.name === '[LOADING]',
      'health system'
    )

    await processEntityType(
      conferenceItems,
      'conferences',
      (item: Conference) => item.name === '[LOADING]',
      'conference'
    )

    return processedItems
  }

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
        
        // Load real data for any placeholder attendees
        const finalAttendees = await loadRealDataForItems(
          selectedAttendees,
          (message) => setError(message)
        ) as Attendee[]
        
        // Get all fields for the first attendee to determine columns
        const firstItemFields = getFieldsForAllColumns(finalAttendees[0])
        
        // Create CSV header from field labels
        const csvHeader = firstItemFields.map((field: { label: string }) => field.label).join(',')
        
        // Create CSV rows for each attendee
        const csvRows = finalAttendees.map(attendee => {
          const fields = getFieldsForAllColumns(attendee)
          return fields.map((field: { value: string }) => escapeCSV(field.value)).join(',')
        })
        
        // Combine header and rows
        const csvContent = [csvHeader, ...csvRows].join('\n')
        
        // Create and trigger download
        downloadCSV(csvContent, `${conferenceName || 'attendees'}_export`)
      } else if (hasHealthSystems) {
        const selectedHealthSystems = getSelectedHealthSystems()
        
        // Load real data for any placeholder health systems
        const finalHealthSystems = await loadRealDataForItems(
          selectedHealthSystems,
          (message) => setError(message)
        ) as HealthSystem[]
        
        // Get all fields for the first health system to determine columns
        const firstItemFields = getFieldsForAllColumns(finalHealthSystems[0])
        
        // Create CSV header from field labels
        const csvHeader = firstItemFields.map((field: { label: string }) => field.label).join(',')
        
        // Create CSV rows for each health system
        const csvRows = finalHealthSystems.map(healthSystem => {
          const fields = getFieldsForAllColumns(healthSystem)
          return fields.map((field: { value: string }) => escapeCSV(field.value)).join(',')
        })
        
        // Combine header and rows
        const csvContent = [csvHeader, ...csvRows].join('\n')
        
        // Create and trigger download
        downloadCSV(csvContent, `health_systems_export`)
      } else if (hasConferences) {
        const selectedConferences = getSelectedConferences()
        
        // Load real data for any placeholder conferences
        const finalConferences = await loadRealDataForItems(
          selectedConferences,
          (message) => setError(message)
        ) as Conference[]
        
        // Get all fields for the first conference to determine columns
        const firstItemFields = getFieldsForAllColumns(finalConferences[0])
        
        // Create CSV header from field labels
        const csvHeader = firstItemFields.map((field: { label: string }) => field.label).join(',')
        
        // Create CSV rows for each conference
        const csvRows = finalConferences.map(conference => {
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

      // Load real data for any placeholder attendees
      const finalAttendees = await loadRealDataForItems(
        selectedAttendees,
        (message) => setError(message)
      ) as Attendee[]

      // Helper function to calculate string similarity (Levenshtein distance based)
      const stringSimilarity = (str1: string, str2: string): number => {
        const len1 = str1.length
        const len2 = str2.length
        const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null))
        
        for (let i = 0; i <= len1; i++) matrix[0][i] = i
        for (let j = 0; j <= len2; j++) matrix[j][0] = j
        
        for (let j = 1; j <= len2; j++) {
          for (let i = 1; i <= len1; i++) {
            const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1
            matrix[j][i] = Math.min(
              matrix[j][i - 1] + 1, // deletion
              matrix[j - 1][i] + 1, // insertion
              matrix[j - 1][i - 1] + substitutionCost // substitution
            )
          }
        }
        
        const maxLen = Math.max(len1, len2)
        return maxLen === 0 ? 1 : (maxLen - matrix[len2][len1]) / maxLen
      }

      // Helper function to check if contact is oncology/cancer related
      const isOncologyRelated = (contact: any): boolean => {
        const oncologyKeywords = [
          'oncology', 'oncologist', 'cancer', 'tumor', 'chemotherapy', 'radiation',
          'hematology', 'leukemia', 'lymphoma', 'melanoma', 'carcinoma',
          'oncological', 'chemotherap', 'radiolog', 'patholog', 'surgical oncolog',
          'medical oncolog', 'radiation oncolog', 'hematolog oncolog',
          'gynecologic oncolog', 'pediatric oncolog', 'neuro-oncolog'
        ]
        
        const searchText = [
          contact.title || '',
          contact.headline || '',
          contact.organization?.name || '',
          contact.organization?.industry || '',
          ...(contact.employment_history || []).map((job: any) => `${job.title} ${job.organization_name}`)
        ].join(' ').toLowerCase()
        
        return oncologyKeywords.some(keyword => searchText.includes(keyword))
      }

      // Helper function to find best match for an attendee
      const findBestMatch = (attendee: any, allMatches: any[]) => {
        if (!allMatches || allMatches.length === 0) return null
        
        // Filter matches to only those that could be for this attendee
        // Look for candidates tagged with similar contact info
        const candidatesForThisAttendee = allMatches.filter((match: any) => {
          if (!match._originalContact) return false
          
          const original = match._originalContact
          
          // Check if this match was found for this specific attendee
          const firstNameMatch = stringSimilarity(
            original.firstName?.toLowerCase() || '',
            attendee.first_name.toLowerCase()
          ) > 0.7
          
          const lastNameMatch = stringSimilarity(
            original.lastName?.toLowerCase() || '',
            attendee.last_name.toLowerCase()
          ) > 0.7
          
          return firstNameMatch && lastNameMatch
        })
        
        console.log(`\n=== Evaluating ${candidatesForThisAttendee.length} candidates for ${attendee.first_name} ${attendee.last_name} ===`)
        console.log(`Company: ${attendee.company || 'N/A'}`)
        console.log(`Title: ${attendee.title || 'N/A'}`)
        
        if (candidatesForThisAttendee.length === 0) {
          return null
        }
        
        // Score each potential match
        const scoredMatches = candidatesForThisAttendee.map(match => {
          let score = 0
          let details: string[] = []
          
          // 1. Name similarity (40% of total score)
          const firstNameSimilarity = stringSimilarity(
            match.first_name?.toLowerCase() || '', 
            attendee.first_name.toLowerCase()
          )
          const lastNameSimilarity = stringSimilarity(
            match.last_name?.toLowerCase() || '', 
            attendee.last_name.toLowerCase()
          )
          const nameScore = (firstNameSimilarity * 0.4 + lastNameSimilarity * 0.6) * 40
          score += nameScore
          details.push(`Name: ${nameScore.toFixed(1)}`)
          
          // 2. Company similarity (25% of total score)
          let companyScore = 0
          if (attendee.company && match.organization?.name) {
            const companyName = attendee.company.toLowerCase()
            const matchCompanyName = match.organization.name.toLowerCase()
            
            if (companyName === matchCompanyName) {
              companyScore = 25 // Perfect match
            } else if (companyName.includes(matchCompanyName) || matchCompanyName.includes(companyName)) {
              companyScore = 20 // Partial match
            } else {
              const companySimilarity = stringSimilarity(companyName, matchCompanyName)
              companyScore = companySimilarity * 15 // Fuzzy match
            }
          }
          score += companyScore
          details.push(`Company: ${companyScore.toFixed(1)}`)
          
          // 3. Oncology relevance (25% of total score - high priority)
          let oncologyScore = 0
          if (isOncologyRelated(match)) {
            oncologyScore = 25
            details.push(`Oncology: ${oncologyScore}`)
          } else {
            details.push(`Oncology: 0`)
          }
          score += oncologyScore
          
          // 4. Title relevance (7% of total score)
          let titleScore = 0
          if (attendee.title && match.title) {
            const titleSimilarity = stringSimilarity(
              attendee.title.toLowerCase(), 
              match.title.toLowerCase()
            )
            titleScore = titleSimilarity * 7
          }
          score += titleScore
          details.push(`Title: ${titleScore.toFixed(1)}`)
          
          // 5. Employment recency bonus (3% of total score)
          let recencyScore = 0
          if (match.employment_history && match.employment_history.length > 0) {
            const currentJob = match.employment_history.find((job: any) => job.current)
            if (currentJob) {
              recencyScore = 3
            } else {
              // Check if most recent job is within last 2 years
              const mostRecent = match.employment_history
                .filter((job: any) => job.end_date)
                .sort((a: any, b: any) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime())[0]
              
              if (mostRecent) {
                const endDate = new Date(mostRecent.end_date)
                const twoYearsAgo = new Date()
                twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
                
                if (endDate > twoYearsAgo) {
                  recencyScore = 1.5
                }
              }
            }
          }
          score += recencyScore
          details.push(`Recency: ${recencyScore}`)
          
          return {
            match,
            score,
            details: details.join(', '),
            breakdown: {
              nameScore,
              companyScore,
              oncologyScore,
              titleScore,
              recencyScore
            }
          }
        })
        
        // Sort by score (highest first) and get top 5
        const topCandidates = scoredMatches
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)
        
        // Return the best match if it meets minimum criteria
        const bestCandidate = topCandidates[0]
        
        if (!bestCandidate) return null
        
        // Minimum thresholds for acceptance
        const minNameScore = 30 // At least 75% name similarity (30/40)
        const minTotalScore = 35 // At least 35% overall confidence
        
        if (bestCandidate.breakdown.nameScore >= minNameScore && bestCandidate.score >= minTotalScore) {
          console.log(`✅ Selected: ${bestCandidate.match.first_name} ${bestCandidate.match.last_name} (Score: ${bestCandidate.score.toFixed(1)})`)
          return bestCandidate.match
        } else {
          return null
        }
      }

      // Batch processing for large sets of attendees
      const BATCH_SIZE = 20
      const allResults: Array<{
        attendee: Attendee
        success: boolean
        error?: string
      }> = []
      let totalEnriched = 0
      let failedBatches = 0
      let processedAttendees = 0
      
      // Process attendees in batches
      for (let i = 0; i < finalAttendees.length; i += BATCH_SIZE) {
        const batchAttendees = finalAttendees.slice(i, i + BATCH_SIZE)
        processedAttendees += batchAttendees.length
        
        try {
          // Update status message
          setError(`Enriching batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(finalAttendees.length/BATCH_SIZE)} (${processedAttendees}/${finalAttendees.length})`)
          
          // No need to load placeholder data since we already have real data from loadRealDataForItems
          
          // Prepare the data for Apollo API
          const details = batchAttendees.map((attendee: Attendee) => ({
            firstName: attendee.first_name,
            lastName: attendee.last_name,
            organization: attendee.company || '',
            title: attendee.title || '',
            email: attendee.email || '',
            phone: attendee.phone || '',
            linkedinUrl: attendee.linkedin_url || ''
          }))
          
          console.log(`📤 Sending batch ${Math.floor(i/BATCH_SIZE) + 1} to Apollo:`, {
            batchSize: details.length,
            sampleRecord: details[0],
            hasEmail: details.filter(d => d.email).length,
            hasTitle: details.filter(d => d.title).length,
            hasOrganization: details.filter(d => d.organization).length
          })
          
          // Call Apollo service to enrich this batch
          const enrichedData = await apolloService.enrichContacts(details)
          
          // Process results for this batch using improved matching
          const batchResults = batchAttendees.map(attendee => {
            const match = findBestMatch(attendee, enrichedData?.matches || [])
            
            if (match) {
              totalEnriched++
              return {
                attendee,
                success: true,
                error: undefined
              }
            } else {
              return {
                attendee,
                success: false,
                error: 'No suitable match found'
              }
            }
          })
          
          // Add batch results to overall results
          allResults.push(...batchResults)
          
        } catch (batchError) {
          console.error(`Error processing batch ${Math.floor(i/BATCH_SIZE) + 1}:`, batchError)
          failedBatches++
          
          // Add failed results for this batch
          const failedResults = batchAttendees.map(attendee => ({
            attendee,
            success: false,
            error: batchError instanceof Error ? batchError.message : 'Batch processing failed'
          }))
          
          allResults.push(...failedResults)
        }
        
        // Brief pause between batches to avoid rate limiting
        if (i + BATCH_SIZE < finalAttendees.length) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
      
      // Set overall results
      setEnrichmentResults(allResults)
      setIsSuccessModalOpen(true)
      
      // Clear selection after successful enrichment
      deselectAll()
      
      // Call the completion handler in the background with the raw results
      // This avoids the type errors while still providing enrichment data
      Promise.resolve(onEnrichmentComplete({
        status: 'success',
        error_code: null,
        error_message: null,
        total_requested_enrichments: finalAttendees.length,
        unique_enriched_records: totalEnriched,
        missing_records: finalAttendees.length - totalEnriched,
        credits_consumed: finalAttendees.length,
        matches: []  // Empty array to avoid type issues, UI will use allResults instead
      } as ApolloEnrichmentResponse)).catch((err: Error) => {
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

      // Load real data for any placeholder health systems
      const finalHealthSystems = await loadRealDataForItems(
        selectedHealthSystems,
        (message) => setError(message)
      ) as HealthSystem[]

      // Process in batches for better efficiency
      const BATCH_SIZE = 20
      const allResults: DefinitiveEnrichmentResult[] = []
      let processedSystems = 0
      let successCount = 0
      let failCount = 0
      
      // Process in batches
      for (let i = 0; i < finalHealthSystems.length; i += BATCH_SIZE) {
        const batchSystems = finalHealthSystems.slice(i, i + BATCH_SIZE)
        processedSystems += batchSystems.length
        
        try {
          // Update status message
          setError(`Enriching batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(finalHealthSystems.length/BATCH_SIZE)} (${processedSystems}/${finalHealthSystems.length})`)
          
          // No need to load placeholder data since we already have real data from loadRealDataForItems
          
          // Call Definitive service to enrich this batch of health systems
          const batchEnrichedData = await definitiveService.enrichHealthSystems(batchSystems)
          
          // Add batch results to overall results
          allResults.push(...batchEnrichedData)
          
          // Update counts
          successCount += batchEnrichedData.filter(result => result.success).length
          failCount += batchEnrichedData.filter(result => !result.success).length
          
          // Process successful enrichments for this batch
          const successfullyEnriched = batchEnrichedData.filter(result => result.success)
          
          if (successfullyEnriched.length > 0) {
            try {
              // Define the required columns with their types
              const requiredColumns = [
                { name: 'ambulatory_ehr', type: 'text' },
                { name: 'net_patient_revenue', type: 'number' },
                { name: 'number_of_beds', type: 'number' },
                { name: 'state', type: 'text' },
                { name: 'number_of_hospitals_in_network', type: 'number' }
              ];
              
              // Ensure all required columns exist before updating data
              for (const column of requiredColumns) {
                const columnCreated = await ensureColumnExists('health_systems', column.name, column.type);
                console.log(`Column creation for health_systems.${column.name} ${columnCreated ? 'succeeded' : 'failed'}`);
              }
              
              // Update each successfully enriched health system
              for (const result of successfullyEnriched) {
                const { healthSystem } = result
                
                // Update the health system in Supabase with all the fields
                const { error } = await supabase
                  .from('health_systems')
                  .update({
                    definitive_id: healthSystem.definitive_id,
                    website: healthSystem.website,
                    address: healthSystem.address,
                    city: healthSystem.city,
                    state: healthSystem.state,
                    zip: healthSystem.zip,
                    ambulatory_ehr: healthSystem.ambulatory_ehr,
                    net_patient_revenue: healthSystem.net_patient_revenue,
                    number_of_beds: healthSystem.number_of_beds,
                    number_of_hospitals_in_network: healthSystem.number_of_hospitals_in_network
                  })
                  .eq('id', healthSystem.id)
                  
                if (error) {
                  console.error(`Error updating health system ${healthSystem.id}:`, error);
                }
              }
            } catch (updateError) {
              console.error('Error updating health systems in batch:', updateError)
            }
          }
          
        } catch (batchError) {
          console.error(`Error processing batch ${Math.floor(i/BATCH_SIZE) + 1}:`, batchError)
          
          // Add failed results for this batch
          const failedResults = batchSystems.map(system => ({
            success: false,
            healthSystem: system,
            error: batchError instanceof Error ? batchError.message : 'Batch processing failed'
          })) as DefinitiveEnrichmentResult[]
          
          allResults.push(...failedResults)
          failCount += batchSystems.length
        }
        
        // Brief pause between batches
        if (i + BATCH_SIZE < finalHealthSystems.length) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
      
      // Store the overall results
      setDefinitiveEnrichmentResults(allResults)
      setIsDefinitiveSuccessModalOpen(true)
      
      // Clear selection after successful enrichment
      deselectAll()
      
      // Call the completion handler with the results
      if (onDefinitiveEnrichmentComplete) {
        onDefinitiveEnrichmentComplete(allResults)
      }
    } catch (err) {
      console.error('Definitive enrichment error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to enrich health systems'
      setError(errorMessage)
    } finally {
      setIsDefinitiveEnriching(false)
    }
  }

  const handleBulkAIEnrich = async () => {
    try {
      setError(null)

      if (selectedItems.length === 0) {
        setError('Please select at least one item')
        return
      }

      // Load real data for any placeholder items
      const finalItems = await loadRealDataForItems(
        selectedItems,
        (message) => setError(message)
      )

      // Set the items for the AI enrichment dialog (processed with real data)
      setAiEnrichmentItems(finalItems)

      // Open the AI enrichment dialog with real data
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

  const handleBulkDelete = async () => {
    try {
      setIsDeleting(true)
      setError(null)

      if (selectedItems.length === 0) {
        setError('Please select at least one item')
        return
      }

      // Note: Most delete operations only need IDs, but we'll check if we need to load real data
      // based on what the parent onDelete handler expects. For now, we'll pass items as-is
      // since delete operations typically work with IDs only.
      
      // If the parent component needs real data for some reason, we could add placeholder
      // loading here similar to other operations, but typically delete only needs IDs.

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

  const handleBulkPushToApollo = async () => {
    try {
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

      // Load real data for any placeholder attendees
      const finalAttendees = await loadRealDataForItems(
        selectedAttendees,
        (message) => setError(message)
      ) as Attendee[]

      // Validate that all final attendees have valid IDs
      const invalidAttendees = finalAttendees.filter(attendee => !attendee.id || attendee.id === '')
      if (invalidAttendees.length > 0) {
        setError('Some selected attendees have invalid data. Please refresh the page and try again.')
        return
      }
      
      // Store the processed attendees for use in handleListSelected
      setProcessedAttendeesForList(finalAttendees)
      setIsListModalOpen(true)
    } catch (err) {
      console.error('Error preparing Apollo push:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to prepare attendees for Apollo push'
      setError(errorMessage)
    }
  }

  const handleBulkAddToList = async () => {
    try {
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

      // Load real data for any placeholder attendees
      const finalAttendees = await loadRealDataForItems(
        selectedAttendees,
        (message) => setError(message)
      ) as Attendee[]

      // Validate that all final attendees have valid IDs
      const invalidAttendees = finalAttendees.filter(attendee => !attendee.id || attendee.id === '')
      if (invalidAttendees.length > 0) {
        setError('Some selected attendees have invalid data. Please refresh the page and try again.')
        return
      }
      
      // Store the processed attendees for use in handleAddAttendeesList
      setProcessedAttendeesForList(finalAttendees)
      setIsAddToListModalOpen(true)
    } catch (err) {
      console.error('Error preparing add to list:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to prepare attendees for list addition'
      setError(errorMessage)
    }
  }

  const handleAddAttendeesList = async (listName: string) => {
    setIsAddingToList(true)
    setError(null)
    setSelectedListName(listName)
    
    try {
      // Use the processed attendees that were loaded in handleBulkAddToList
      const attendeesToProcess = processedAttendeesForList.length > 0 ? processedAttendeesForList : getSelectedAttendees()
      
      if (attendeesToProcess.length === 0) {
        throw new Error('No attendees to process')
      }

      // Additional validation for attendee IDs (should already be validated, but double-check)
      const invalidAttendees = attendeesToProcess.filter(attendee => !attendee.id || attendee.id === '')
      if (invalidAttendees.length > 0) {
        throw new Error(`${invalidAttendees.length} attendee(s) have invalid data. Please refresh and try again.`)
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

      // Process in batches for better efficiency
      const BATCH_SIZE = 50
      const allResults: Array<{
        attendee: Attendee
        success: boolean
        error?: string
      }> = []
      let processedAttendees = 0
      
      // Process in batches
      for (let i = 0; i < attendeesToProcess.length; i += BATCH_SIZE) {
        const batchAttendees = attendeesToProcess.slice(i, i + BATCH_SIZE)
        processedAttendees += batchAttendees.length
        
        try {
          // Update status message
          setError(`Adding batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(attendeesToProcess.length/BATCH_SIZE)} to list (${processedAttendees}/${attendeesToProcess.length})`)
          
          // No need to load placeholder data since we already have real data from handleBulkAddToList
          
          // Prepare entries for the batch
          const batchEntries = batchAttendees.map(attendee => ({
            attendee_id: attendee.id,
            list_id: listId
          }))
          
          // Validate that all entries have valid IDs before proceeding
          const invalidEntries = batchEntries.filter(entry => !entry.attendee_id || entry.attendee_id === '')
          if (invalidEntries.length > 0) {
            throw new Error(`${invalidEntries.length} attendee(s) have invalid IDs and cannot be added to the list`)
          }
          
          // First check which attendees are already in the list to avoid duplicates
          const { data: existingEntries, error: existingEntriesError } = await supabase
            .from('attendee_lists')
            .select('attendee_id')
            .eq('list_id', listId)
            .in('attendee_id', batchAttendees.map(a => a.id))
            
          if (existingEntriesError) throw existingEntriesError
          
          // Filter out attendees that are already in the list
          const existingIds = new Set((existingEntries || []).map(e => e.attendee_id))
          const newEntries = batchEntries.filter(entry => !existingIds.has(entry.attendee_id))
          
          // Track batch results
          const batchResults: Array<{
            attendee: Attendee
            success: boolean
            error?: string
          }> = []
          
          // Add existing entries as already successful
          batchAttendees.forEach(attendee => {
            if (existingIds.has(attendee.id)) {
              batchResults.push({
                attendee,
                success: true,
                error: 'Already in list'
              })
            }
          })
          
          // If we have new entries, insert them
          if (newEntries.length > 0) {
            const { error: insertError } = await supabase
              .from('attendee_lists')
              .insert(newEntries)
              
            if (insertError) {
              throw insertError
            }
            
            // Add successful results for newly added attendees
            batchAttendees.forEach(attendee => {
              if (!existingIds.has(attendee.id)) {
                batchResults.push({
                  attendee,
                  success: true
                })
              }
            })
          }
          
          // Add batch results to overall results
          allResults.push(...batchResults)
          
        } catch (batchError) {
          console.error(`Error processing batch ${Math.floor(i/BATCH_SIZE) + 1}:`, batchError)
          
          // Add failed results for this batch
          const failedResults = batchAttendees.map(attendee => ({
            attendee,
            success: false,
            error: batchError instanceof Error ? batchError.message : 'Batch processing failed'
          }))
          
          allResults.push(...failedResults)
        }
        
        // Brief pause between batches
        if (i + BATCH_SIZE < attendeesToProcess.length) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
      
      // Set final results and show dialog
      setAddToListResults(allResults)
      setIsAddToListResultsModalOpen(true)
      
      // First refresh the lists
      if (refreshLists) {
        await refreshLists();
      }
      
      // Clear selection after adding to list
      deselectAll()
      
      // Clear the processed attendees
      setProcessedAttendeesForList([])
    } catch (err) {
      console.error('Error adding to list:', err)
      setError(err instanceof Error ? err.message : 'Failed to add attendees to list')
    } finally {
      setIsAddingToList(false)
    }
  }

  const handleListSelected = async (listName: string) => {
    setIsPushing(true)
    setError(null)
    setSelectedListName(listName)
    
    try {
      if (!hasAttendees || hasMixedSelection) {
        throw new Error('Please select only attendees to push to Apollo')
      }
      
      // Use the processed attendees that were loaded in handleBulkPushToApollo
      const attendeesToProcess = processedAttendeesForList.length > 0 ? processedAttendeesForList : getSelectedAttendees()
      
      if (attendeesToProcess.length === 0) {
        throw new Error('No attendees to process')
      }

      // Additional validation for attendee IDs (should already be validated, but double-check)
      const invalidAttendees = attendeesToProcess.filter(attendee => !attendee.id || attendee.id === '')
      if (invalidAttendees.length > 0) {
        throw new Error(`${invalidAttendees.length} attendee(s) have invalid data. Please refresh and try again.`)
      }

      // Process in batches for better efficiency
      const BATCH_SIZE = 20
      const allResults: Array<{
        attendee: Attendee
        success: boolean
        error?: string
      }> = []
      let processedAttendees = 0
      
      // Process in batches
      for (let i = 0; i < attendeesToProcess.length; i += BATCH_SIZE) {
        const batchAttendees = attendeesToProcess.slice(i, i + BATCH_SIZE)
        processedAttendees += batchAttendees.length
        
        try {
          // Update status message
          setError(`Pushing batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(attendeesToProcess.length/BATCH_SIZE)} to Apollo (${processedAttendees}/${attendeesToProcess.length})`)
          
          // No need to load placeholder data since we already have real data from handleBulkPushToApollo
          
          // Convert attendees to Apollo contacts
          const contacts: ApolloContactCreate[] = batchAttendees.map(attendee => ({
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
          
          // All contacts in this batch were successfully pushed
          const batchResults = batchAttendees.map(attendee => ({
            attendee,
            success: true
          }))
          
          // Add batch results to overall results
          allResults.push(...batchResults)
          
        } catch (batchError) {
          console.error(`Error processing batch ${Math.floor(i/BATCH_SIZE) + 1}:`, batchError)
          
          // Add failed results for this batch
          const failedResults = batchAttendees.map(attendee => ({
            attendee,
            success: false,
            error: batchError instanceof Error ? batchError.message : 'Batch processing failed'
          }))
          
          allResults.push(...failedResults)
        }
        
        // Brief pause between batches
        if (i + BATCH_SIZE < attendeesToProcess.length) {
          await new Promise(resolve => setTimeout(resolve, 300))
        }
      }
      
      // Show final results
      setPushResults(allResults)
      setIsPushResultsModalOpen(true)
      
      // Clear selection after successful push
      deselectAll()
      
      // Clear the processed attendees
      setProcessedAttendeesForList([])
    } catch (err) {
      console.error('Error pushing to Apollo:', err)
      
      // If we have attendees but the push failed, mark all as failed
      const attendeesToProcess = processedAttendeesForList.length > 0 ? processedAttendeesForList : getSelectedAttendees()
      
      if (attendeesToProcess.length > 0) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to push contacts to Apollo'
        const results = attendeesToProcess.map(attendee => ({
          attendee,
          success: false,
          error: errorMessage
        }))
        
        setPushResults(results)
        setIsPushResultsModalOpen(true)
      } else {
        setError(err instanceof Error ? err.message : 'Failed to push contacts to Apollo')
      }
      
      // Clear the processed attendees
      setProcessedAttendeesForList([])
    } finally {
      setIsPushing(false)
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

  if (selectedItems.length === 0 && !isSelectingAll) {
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
              {isSelectingAll && selectedItems.length === 0 
                ? 'Selecting all items...' 
                : `${selectedItems.length} selected`}
            </span>

            {selectedItems.length > 0 && !isSelectingAll && (
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
            {(selectedItems.length > 0 || isSelectingAll) && (
              <>
                {/* Show enrich button only for attendees */}
                {hasAttendees && !hasMixedSelection && (
                  <button 
                    onClick={handleBulkEnrich}
                    disabled={isEnriching || isSelectingAll}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none disabled:opacity-50"
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
                    disabled={isDefinitiveEnriching || isSelectingAll}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none disabled:opacity-50"
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
                  disabled={isAIEnriching || isSelectingAll}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-purple-700 bg-purple-100 hover:bg-purple-200 focus:outline-none disabled:opacity-50"
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
                  disabled={isExporting || isSelectingAll}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none disabled:opacity-50"
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
                    disabled={isPushing || isSelectingAll}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-purple-700 bg-purple-100 hover:bg-purple-200 focus:outline-none disabled:opacity-50"
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
                    disabled={isAddingToList || isSelectingAll}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-yellow-700 bg-yellow-100 hover:bg-yellow-200 focus:outline-none disabled:opacity-50"
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
                  disabled={isDeleting || isSelectingAll}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none disabled:opacity-50"
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
        onClose={() => {
          setIsAIEnrichmentModalOpen(false)
          setAiEnrichmentItems([]) // Clear the processed items when dialog closes
        }}
        items={aiEnrichmentItems.length > 0 ? aiEnrichmentItems : selectedItems}
        onEnrichmentComplete={(results, columnName) => handleAIEnrichmentComplete(results, columnName)}
        allColumns={allColumns}
        getFieldsForAllColumns={getFieldsForAllColumns}
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