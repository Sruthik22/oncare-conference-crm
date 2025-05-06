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
  // Initialize with default visible columns for each tab
  const [visibleColumns, setVisibleColumns] = useState<Record<TabType, string[]>>({
    attendees: ['name', 'email', 'phone', 'title', 'company'],
    'health-systems': ['name', 'location', 'website'],
    conferences: ['name', 'date', 'location'],
  })
  
  // Detect and add custom columns
  useEffect(() => {
    if (columns.length) {
      // Add any existing columns not already in visibleColumns
      const customColumns = columns
        .filter(col => col.id && col.id !== 'name' && !visibleColumns[activeTab].includes(col.id as string))
        .map(col => col.id as string);
      
      if (customColumns.length) {
        setVisibleColumns(prev => ({
          ...prev,
          [activeTab]: [...prev[activeTab], ...customColumns]
        }));
      }
    }
  }, [columns, activeTab]);

  // Track column order separately from visibility
  const [columnOrder, setColumnOrder] = useState<string[]>([])

  // Initialize columnOrder when view changes or when active tab changes
  useEffect(() => {
    setColumnOrder(visibleColumns[activeTab]);
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
    
    // Use columnOrder for consistent ordering between views
    const orderedColumns: ColumnDef<Attendee | HealthSystem | Conference>[] = [];
    
    // Always include the name column first if it exists
    const nameColumn = columns.find(col => col.id === 'name')
    if (nameColumn) {
      orderedColumns.push(nameColumn);
    }
    
    // Add remaining columns in the order specified by columnOrder
    columnOrder.forEach(id => {
      if (id !== 'name' && currentVisibleColumns.includes(id)) {
        const col = columns.find(col => col.id === id);
        if (col) {
          orderedColumns.push(col);
        }
      }
    });
    
    // Add any visible columns that are not in columnOrder
    currentVisibleColumns.forEach(id => {
      if (id !== 'name' && !columnOrder.includes(id)) {
        const col = columns.find(col => col.id === id);
        if (col) {
          orderedColumns.push(col);
        }
      }
    });
    
    return orderedColumns;
  }

  return {
    visibleColumns,
    columnOrder,
    setColumnOrder,
    handleColumnToggle,
    getVisibleColumns,
  }
} 