'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import React from 'react'
import { HealthSystemDetailAdapter } from '@/components/features/health-systems/HealthSystemDetailAdapter'
import Link from 'next/link'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { Icon } from '@/components/ui/Icon'
import { useDataFetching } from '@/hooks/useDataFetching'
import type { HealthSystem } from '@/types'
import { TabNavigation } from '@/components/layout/TabNavigation'
import { SelectionProvider } from '@/lib/context/SelectionContext'
import { supabase } from '@/lib/supabase'

// Define the params type locally
interface PageParams {
  id: string;
}

export default function HealthSystemDetailPage({ params }: { params: Promise<PageParams> }) {
  const router = useRouter()
  const { id } = React.use(params)
  const { healthSystems } = useDataFetching()
  const [healthSystem, setHealthSystem] = useState<HealthSystem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    
    const fetchHealthSystem = async () => {
      try {
        // First check if we have the health system in the local cache
        if (healthSystems && Array.isArray(healthSystems)) {
          const foundHealthSystem = healthSystems.find(hs => hs && hs.id === id)
          if (foundHealthSystem) {
            setHealthSystem(foundHealthSystem)
            setLoading(false)
            return
          }
        }
        
        // If not found in cache, fetch from database
        const { data, error: fetchError } = await supabase
          .from('health_systems')
          .select(`
            *,
            attendees (
              id,
              first_name,
              last_name,
              title,
              company,
              email,
              phone
            )
          `)
          .eq('id', id)
          .single()
        
        if (!isMounted) return
        
        if (fetchError) {
          console.error('Error fetching health system:', fetchError)
          setError(`Failed to load health system: ${fetchError.message}`)
        } else if (data) {
          setHealthSystem(data as HealthSystem)
        } else {
          setHealthSystem(null)
        }
      } catch (e) {
        if (!isMounted) return
        console.error('Error in fetchHealthSystem:', e)
        setError(`An unexpected error occurred: ${e instanceof Error ? e.message : String(e)}`)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }
    
    fetchHealthSystem()
    
    return () => {
      isMounted = false
    }
  }, [id])

  const handleUpdate = (updatedHealthSystem: HealthSystem) => {
    setHealthSystem(updatedHealthSystem)
  }

  const handleDelete = (_deletedHealthSystemId: string) => {
    router.push('/health-systems')
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
            activeTab="health-systems"
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
            activeTab="health-systems"
          />
          <div className="flex-1 flex flex-col items-center justify-center">
            <p className="text-xl mb-4 text-red-600">Error</p>
            <p className="text-gray-700 mb-4">{error}</p>
            <Link href="/health-systems" className="text-blue-600 hover:underline">Return to Health Systems</Link>
          </div>
        </div>
      </SelectionProvider>
    )
  }

  if (!healthSystem) {
    return (
      <SelectionProvider>
        <div className="flex h-screen">
          <TabNavigation
            tabs={tabs}
            activeTab="health-systems"
          />
          <div className="flex-1 flex flex-col items-center justify-center">
            <p className="text-xl mb-4">Health System not found</p>
            <Link href="/health-systems" className="text-blue-600 hover:underline">Return to Health Systems</Link>
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
          activeTab="health-systems"
        />
        <div className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="mb-6">
              <Link href="/health-systems" className="inline-flex items-center text-gray-600 hover:text-gray-900">
                <Icon icon={ArrowLeftIcon} size="sm" className="mr-2" />
                Back to Health Systems
              </Link>
            </div>
            
            <HealthSystemDetailAdapter 
              healthSystem={healthSystem}
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