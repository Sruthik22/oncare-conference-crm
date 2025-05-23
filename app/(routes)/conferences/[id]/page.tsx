'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import React from 'react'
import { ConferenceDetailAdapter } from '@/components/features/conferences/ConferenceDetailAdapter'
import Link from 'next/link'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { Icon } from '@/components/ui/Icon'
import { useDataFetching } from '@/hooks/useDataFetching'
import type { Conference } from '@/types'
import { TabNavigation } from '@/components/layout/TabNavigation'
import { SelectionProvider } from '@/lib/context/SelectionContext'
import { supabase } from '@/lib/supabase'

// Define the params type locally
interface PageParams {
  id: string;
}

export default function ConferenceDetailPage({ params }: { params: Promise<PageParams> }) {
  const router = useRouter()
  const { id } = React.use(params)
  const { conferences } = useDataFetching()
  const [conference, setConference] = useState<Conference | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    
    const fetchConference = async () => {
      try {
        // First check if we have the conference in the local cache
        if (conferences && Array.isArray(conferences)) {
          const foundConference = conferences.find(c => c && c.id === id)
          if (foundConference) {
            setConference(foundConference)
            setLoading(false)
            return
          }
        }
        
        // If not found in cache, fetch from database
        const { data, error: fetchError } = await supabase
          .from('conferences')
          .select(`
            *,
            attendee_conferences (
              id,
              attendee_id,
              attendees (
                id,
                first_name,
                last_name,
                title,
                company,
                email
              )
            )
          `)
          .eq('id', id)
          .single()
        
        if (!isMounted) return
        
        if (fetchError) {
          console.error('Error fetching conference:', fetchError)
          setError(`Failed to load conference: ${fetchError.message}`)
        } else if (data) {
          // Process the data to ensure consistent structure
          if (data.attendee_conferences) {
            data.attendee_conferences = data.attendee_conferences.map((ac: { id: string; attendee_id: string; attendees: any }) => {
              // Add attendee reference for backward compatibility
              return {
                ...ac,
                attendee: ac.attendees
              }
            })
          }
          
          setConference(data as Conference)
        } else {
          setConference(null)
        }
      } catch (e) {
        if (!isMounted) return
        console.error('Error in fetchConference:', e)
        setError(`An unexpected error occurred: ${e instanceof Error ? e.message : String(e)}`)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }
    
    fetchConference()
    
    return () => {
      isMounted = false
    }
  }, [id])

  const handleUpdate = (updatedConference: Conference) => {
    setConference(updatedConference)
  }

  const handleDelete = (_deletedConferenceId: string) => {
    router.push('/conferences')
  }

  const handleAttendeeClick = (attendeeId: string) => {
    router.push(`/attendees/${attendeeId}`)
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
            activeTab="conferences"
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
            activeTab="conferences"
          />
          <div className="flex-1 flex flex-col items-center justify-center">
            <p className="text-xl mb-4 text-red-600">Error</p>
            <p className="text-gray-700 mb-4">{error}</p>
            <Link href="/conferences" className="text-blue-600 hover:underline">Return to Conferences</Link>
          </div>
        </div>
      </SelectionProvider>
    )
  }

  if (!conference) {
    return (
      <SelectionProvider>
        <div className="flex h-screen">
          <TabNavigation
            tabs={tabs}
            activeTab="conferences"
          />
          <div className="flex-1 flex flex-col items-center justify-center">
            <p className="text-xl mb-4">Conference not found</p>
            <Link href="/conferences" className="text-blue-600 hover:underline">Return to Conferences</Link>
          </div>
        </div>
      </SelectionProvider>
    )
  }

  return (
    <SelectionProvider>
      <div className="flex h-screen">
        <TabNavigation
          tabs={tabs}
          activeTab="conferences"
        />
        <div className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="mb-6">
              <Link href="/conferences" className="inline-flex items-center text-gray-600 hover:text-gray-900">
                <Icon icon={ArrowLeftIcon} size="sm" className="mr-2" />
                Back to Conferences
              </Link>
            </div>
            
            <ConferenceDetailAdapter 
              conference={conference}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onAttendeeClick={handleAttendeeClick}
            />
          </div>
        </div>
      </div>
    </SelectionProvider>
  )
} 