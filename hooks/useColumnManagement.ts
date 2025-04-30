import { useState, useEffect } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import type { Attendee, HealthSystem, Conference } from '@/types'

type TabType = 'attendees' | 'health-systems' | 'conferences'
type ViewType = 'table' | 'cards'

interface UseColumnManagementProps {
  activeTab: TabType
  view: ViewType
  columns: ColumnDef<Attendee | HealthSystem | Conference>[]
}

interface UseColumnManagementResult {
  visibleColumns: Record<TabType, string[]>
  columnOrder: string[]
  setColumnOrder: (order: string[]) => void
  handleColumnToggle: (columnId: string) => void
  getVisibleColumns: () => ColumnDef<Attendee | HealthSystem | Conference>[]
}

export function useColumnManagement({
  activeTab,
  view,
  columns,
}: UseColumnManagementProps): UseColumnManagementResult {
  const [visibleColumns, setVisibleColumns] = useState<Record<TabType, string[]>>({
    attendees: ['name', 'email', 'phone', 'title', 'company'],
    'health-systems': ['name', 'location', 'website'],
    conferences: ['name', 'date', 'location'],
  })
  const [columnOrder, setColumnOrder] = useState<string[]>([])

  // Initialize columnOrder when view changes
  useEffect(() => {
    if (view === 'cards') {
      setColumnOrder(visibleColumns[activeTab])
    }
  }, [view, activeTab, visibleColumns])

  const handleColumnToggle = (columnId: string) => {
    if (columnId === 'name') return // Prevent toggling the name column
    
    setVisibleColumns(prev => {
      const newVisibleColumns = prev[activeTab].includes(columnId)
        ? prev[activeTab].filter(id => id !== columnId)
        : [...prev[activeTab], columnId]
      
      // Update columnOrder to match the new visible columns
      setColumnOrder(prevOrder => {
        if (prev[activeTab].includes(columnId)) {
          // If hiding a column, remove it from the order
          return prevOrder.filter(id => id !== columnId)
        } else {
          // If showing a column, add it to the end of the order
          return [...prevOrder, columnId]
        }
      })
      
      return {
        ...prev,
        [activeTab]: newVisibleColumns
      }
    })
  }

  const getVisibleColumns = () => {
    const currentVisibleColumns = visibleColumns[activeTab]
    // Always include the name column if it exists
    const nameColumn = columns.find(col => col.id === 'name')
    return nameColumn 
      ? [nameColumn, ...columns.filter(col => col.id !== 'name' && currentVisibleColumns.includes(col.id as string))]
      : columns.filter(col => currentVisibleColumns.includes(col.id as string))
  }

  return {
    visibleColumns,
    columnOrder,
    setColumnOrder,
    handleColumnToggle,
    getVisibleColumns,
  }
} 