'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import React from 'react'
import { AttendeeDetailAdapter } from '@/components/features/attendees/AttendeeDetailAdapter'
import Link from 'next/link'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { Icon } from '@/components/ui/Icon'
import { useDataFetching } from '@/hooks/useDataFetching'
import type { Attendee } from '@/types'
import { TabNavigation } from '@/components/layout/TabNavigation'
import { SelectionProvider } from '@/lib/context/SelectionContext'
import { supabase } from '@/lib/supabase'

// Define the params type locally
interface PageParams {
  id: string;
}

export default function AttendeeDetailPage({ params }: { params: Promise<PageParams> }) {
  const router = useRouter()
  const { id } = React.use(params)
  const { attendees } = useDataFetching()
  const [attendee, setAttendee] = useState<Attendee | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    
    const fetchAttendee = async () => {
      try {
        // First check if we have the attendee in the local cache
        if (attendees && Array.isArray(attendees)) {
          const foundAttendee = attendees.find(a => a && a.id === id)
          if (foundAttendee) {
            setAttendee(foundAttendee)
            setLoading(false)
            return
          }
        }
        
        // If not found in cache, fetch from database
        const { data, error: fetchError } = await supabase
          .from('attendees')
          .select(`
            *,
            health_systems (*),
            attendee_conferences (
              id,
              conference_id,
              conferences (
                id,
                name,
                start_date,
                end_date,
                location
              )
            )
          `)
          .eq('id', id)
          .single()
        
        if (!isMounted) return
        
        if (fetchError) {
          console.error('Error fetching attendee:', fetchError)
          setError(`Failed to load attendee: ${fetchError.message}`)
        } else if (data) {
          setAttendee(data as Attendee)
        } else {
          setAttendee(null)
        }
      } catch (e) {
        if (!isMounted) return
        console.error('Error in fetchAttendee:', e)
        setError(`An unexpected error occurred: ${e instanceof Error ? e.message : String(e)}`)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }
    
    fetchAttendee()
    
    return () => {
      isMounted = false
    }
  }, [id])

  const handleUpdate = (updatedAttendee: Attendee) => {
    setAttendee(updatedAttendee)
  }

  const handleDelete = (_deletedAttendeeId: string) => {
    router.push('/attendees')
  }

  const handleHealthSystemClick = (healthSystemId: string) => {
    router.push(`/health-systems/${healthSystemId}`)
  }

  const handleConferenceClick = (conferenceId: string) => {
    router.push(`/conferences/${conferenceId}`)
  }

  // Define tabs for navigation
  const tabs = [
    { id: 'attendees', label: 'Attendees', href: '/attendees' },
    { id: 'health-systems', label: 'Health Systems', href: '/health-systems' },
    { id: 'conferences', label: 'Conferences', href: '/conferences' },
  ]

  if (loading) {
    return (
      <SelectionProvider>
        <div className="flex h-screen">
          <TabNavigation
            tabs={tabs}
            activeTab="attendees"
          />
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent"></div>
          </div>
        </div>
      </SelectionProvider>
    )
  }

  if (error) {
    return (
      <SelectionProvider>
        <div className="flex h-screen">
          <TabNavigation
            tabs={tabs}
            activeTab="attendees"
          />
          <div className="flex-1 flex flex-col items-center justify-center">
            <p className="text-xl mb-4 text-red-600">Error</p>
            <p className="text-gray-700 mb-4">{error}</p>
            <Link href="/attendees" className="text-blue-600 hover:underline">Return to Attendees</Link>
          </div>
        </div>
      </SelectionProvider>
    )
  }

  if (!attendee) {
    return (
      <SelectionProvider>
        <div className="flex h-screen">
          <TabNavigation
            tabs={tabs}
            activeTab="attendees"
          />
          <div className="flex-1 flex flex-col items-center justify-center">
            <p className="text-xl mb-4">Attendee not found</p>
            <Link href="/attendees" className="text-blue-600 hover:underline">Return to Attendees</Link>
          </div>
        </div>
      </SelectionProvider>
    )
  }

  const conferenceName = attendee?.attendee_conferences?.[0]?.conferences?.name || 'Unknown Conference'

  return (
    <SelectionProvider>
      <div className="flex h-screen">
        <TabNavigation
          tabs={tabs}
          activeTab="attendees"
        />
        <div className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="mb-6">
              <Link href="/attendees" className="inline-flex items-center text-gray-600 hover:text-gray-900">
                <Icon icon={ArrowLeftIcon} size="sm" className="mr-2" />
                Back to Attendees
              </Link>
            </div>
            
            <AttendeeDetailAdapter 
              attendee={attendee}
              conferenceName={conferenceName}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onHealthSystemClick={handleHealthSystemClick}
              onConferenceClick={handleConferenceClick}
            />
          </div>
        </div>
      </div>
    </SelectionProvider>
  )
} 