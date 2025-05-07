import { useState, useEffect } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import type { Attendee, HealthSystem, Conference } from '@/types'
import { useDatabaseSchema } from '@/hooks/useDatabaseSchema'

type TabType = 'attendees' | 'health-systems' | 'conferences'

// Define valid icon names
export type IconName = 
  'user' | 'building' | 'calendar' | 'map-pin' | 'envelope' | 'phone' | 
  'briefcase' | 'globe' | 'columns' | 'document-text' | 'link' | 
  'identification' | 'clock' | 'academic-cap' | 'currency-dollar'

interface UseColumnManagementProps {
  activeTab: TabType
  view: 'table' | 'cards'
}

// Field format that works with ItemCard
export interface FieldInfo {
  id: string        // Column ID (database column name)
  label: string     // Display name
  iconName: IconName // Icon name to be resolved by the consumer
  accessorFn?: (item: any) => any  // Function to extract value
  accessorKey?: string             // Direct key to access value
}

interface UseColumnManagementResult {
  visibleColumns: Record<TabType, string[]>
  handleColumnToggle: (columnId: string) => void
  getVisibleColumns: () => ColumnDef<Attendee | HealthSystem | Conference>[]
  allColumns: ColumnDef<Attendee | HealthSystem | Conference>[]
  getFieldsForItem: (item: Attendee | HealthSystem | Conference) => { label: string; value: string; iconName: IconName }[]
}

// Get the icon name for a column by id - exported for reuse in other components
export const getColumnIconName = (columnId: string): IconName => {
  // Based on column name
  switch (columnId) {
    case 'name':
    case 'first_name':
    case 'last_name':
      return 'user';
    case 'email':
      return 'envelope';
    case 'phone':
      return 'phone';
    case 'title':
      return 'briefcase';
    case 'company':
      return 'building';
    case 'location':
    case 'address':
    case 'city':
    case 'state':
    case 'zip':
      return 'map-pin';
    case 'website':
    case 'linkedin_url':
      return 'globe';
    case 'date':
    case 'start_date':
    case 'end_date':
    case 'created_at':
    case 'updated_at':
      return 'calendar';
    case 'id':
    case 'definitive_id':
      return 'identification';
    case 'revenue':
      return 'currency-dollar';
    default:
      // Try to determine icon based on columnId
      if (columnId.includes('email')) {
        return 'envelope';
      } else if (columnId.includes('phone')) {
        return 'phone';
      } else if (columnId.includes('date')) {
        return 'calendar';
      } else if (columnId.includes('url') || columnId.includes('website')) {
        return 'globe';
      } else if (columnId.includes('address') || columnId.includes('location')) {
        return 'map-pin';
      } else if (columnId.includes('company') || columnId.includes('system')) {
        return 'building';
      } else if (columnId.includes('note')) {
        return 'document-text';
      } else if (columnId.includes('link')) {
        return 'link';
      } else if (columnId.includes('time') || columnId.includes('created') || columnId.includes('updated')) {
        return 'clock';
      } else if (columnId.includes('degree') || columnId.includes('education') || columnId.includes('certification')) {
        return 'academic-cap';
      } else if (columnId.includes('id')) {
        return 'identification';
      }
      return 'columns';
  }
}

export function useColumnManagement({
  activeTab,
  view,
}: UseColumnManagementProps): UseColumnManagementResult {
  // Default visible columns
  const defaultVisibleColumns: Record<TabType, string[]> = {
    'attendees': ['name', 'email', 'phone', 'title', 'company'],
    'health-systems': ['name', 'location', 'website'],
    'conferences': ['name', 'date', 'location']
  }

  // Initialize visible columns with defaults
  const [visibleColumns, setVisibleColumns] = useState<Record<TabType, string[]>>(defaultVisibleColumns)
  
  // Get all available columns from the database schema
  const { columns: dbColumns, loading } = useDatabaseSchema()

  // Set initial visible columns based on all available columns and defaults
  useEffect(() => {
    // Only run this effect if the database columns are loaded and not already set
    if (!loading && dbColumns.length > 0) {
      setVisibleColumns(prev => {
        // For each tab, merge saved visible columns with new columns from the database
        const newVisibleColumns = { ...prev };
        
        (Object.keys(newVisibleColumns) as TabType[]).forEach(tab => {
          // Get current visible columns for this tab
          const currentVisible = newVisibleColumns[tab];
          
          // If first time setup or no columns are visible, use defaults
          if (currentVisible.length === 0) {
            newVisibleColumns[tab] = defaultVisibleColumns[tab];
          }
        });
        
        return newVisibleColumns;
      });
    }
  }, [dbColumns, loading]);

  // Get field info for all columns
  const getFieldsInfo = (): FieldInfo[] => {
    const fields: FieldInfo[] = [];
    
    // Filter columns for the current tab
    const relevantColumns = dbColumns.filter(col => {
      switch(activeTab) {
        case 'attendees': return col.table === 'attendees';
        case 'health-systems': return col.table === 'health_systems';
        case 'conferences': return col.table === 'conferences';
        default: return false;
      }
    });
    
    // Create field info for each database column
    relevantColumns.forEach(col => {
      if (activeTab === 'attendees') {
        if (col.id === 'name') {
          fields.push({
            id: 'name',
            label: 'Name',
            iconName: getColumnIconName('name'),
            accessorFn: (row: any) => `${row.first_name} ${row.last_name}`,
          });
        } else {
          fields.push({
            id: col.id,
            label: col.header,
            iconName: getColumnIconName(col.id),
            accessorKey: col.id,
          });
        }
      } else if (activeTab === 'health-systems') {
        if (col.id === 'location') {
          fields.push({
            id: 'location',
            label: 'Location',
            iconName: getColumnIconName('location'),
            accessorFn: (row: any) => `${row.city || ''}, ${row.state || ''}`,
          });
        } else {
          fields.push({
            id: col.id,
            label: col.header,
            iconName: getColumnIconName(col.id),
            accessorKey: col.id,
          });
        }
      } else if (activeTab === 'conferences') {
        if (col.id === 'date') {
          fields.push({
            id: 'date',
            label: 'Date',
            iconName: getColumnIconName('date'),
            accessorFn: (row: any) => {
              if (!row.start_date) return '';
              const start = new Date(row.start_date).toLocaleDateString();
              const end = row.end_date ? new Date(row.end_date).toLocaleDateString() : null;
              return end ? `${start} - ${end}` : start;
            },
          });
        } else {
          fields.push({
            id: col.id,
            label: col.header,
            iconName: getColumnIconName(col.id),
            accessorKey: col.id,
          });
        }
      }
    });
    
    return fields;
  };
  
  const fieldsInfo = getFieldsInfo();
  
  // Convert field info to table columns
  const convertToTableColumns = (): ColumnDef<Attendee | HealthSystem | Conference>[] => {
    return fieldsInfo.map(field => ({
      id: field.id,
      header: field.label,
      accessorKey: field.accessorKey,
      accessorFn: field.accessorFn,
    }));
  };
  
  // Get all columns as table columns
  const allColumns = convertToTableColumns();

  const handleColumnToggle = (columnId: string) => {
    setVisibleColumns(prev => {
      const currentColumns = prev[activeTab]
      const newColumns = currentColumns.includes(columnId)
        ? currentColumns.filter(id => id !== columnId)
        : [...currentColumns, columnId]
      
      return {
        ...prev,
        [activeTab]: newColumns
      }
    })
  }

  const getVisibleColumns = () => {
    return allColumns.filter(col => visibleColumns[activeTab].includes(String(col.id)))
  }
  
  // Get field data for an item to display in ItemCard
  const getFieldsForItem = (item: Attendee | HealthSystem | Conference) => {
    const fields: { label: string; value: string; iconName: IconName }[] = []
    const visibleColumnIds = visibleColumns[activeTab]
    
    // Skip name as it's shown as the card title
    const visibleFields = fieldsInfo.filter(field => 
      visibleColumnIds.includes(field.id) && field.id !== 'name'
    );
    
    visibleFields.forEach(field => {
      let value = '';
      
      if (field.accessorFn) {
        value = String(field.accessorFn(item) || '');
      } else if (field.accessorKey) {
        value = String((item as any)[field.accessorKey] || '');
      }
      
      fields.push({
        label: field.label,
        value,
        iconName: field.iconName
      });
    });
    
    return fields;
  }

  return {
    visibleColumns,
    handleColumnToggle,
    getVisibleColumns,
    allColumns,
    getFieldsForItem
  }
} 