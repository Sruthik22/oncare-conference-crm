'use client'

import { SelectionProvider } from '@/lib/context/SelectionContext'
import { Auth } from '@/components/features/auth/Auth'
import { useAuth } from '@/hooks/useAuth'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isLoading } = useAuth()
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    )
  }

  if (!user) {
    return <Auth />
  }

  return (
    <SelectionProvider>
      <div className="min-h-screen bg-gray-50">
        {children}
      </div>
    </SelectionProvider>
  )
} 