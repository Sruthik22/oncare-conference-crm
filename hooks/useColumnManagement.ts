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
}

// Field format that works with ItemCard
export interface FieldInfo {
  id: string        // Column ID (database column name)
  label: string     // Display name
  iconName: IconName // Icon name to be resolved by the consumer
  accessorFn?: (item: any) => any  // Function to extract value
  accessorKey?: string             // Direct key to access value
  isForeignKey?: boolean           // Whether this field is a foreign key
  foreignTable?: string            // The referenced table (if a foreign key)
  dataType?: string                // Data type of the field from database schema
}

interface UseColumnManagementResult {
  visibleColumns: Record<TabType, string[]>
  handleColumnToggle: (columnId: string) => void
  getVisibleColumns: () => ColumnDef<Attendee | HealthSystem | Conference>[]
  allColumns: ColumnDef<Attendee | HealthSystem | Conference>[]
  getFieldsForItem: (item: Attendee | HealthSystem | Conference) => { id: string, label: string, value: string, iconName: IconName }[]
  getFieldsForAllColumns: (item: Attendee | HealthSystem | Conference) => { id: string, label: string, value: string, iconName: IconName }[]
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
    case 'attendees':
      return 'user';
    case 'health_systems':
      return 'building';
    case 'conferences':
      return 'calendar';
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

// Helper function to get the display field for an entity type
const getDefaultDisplayField = (tableName: string): string => {
  switch (tableName) {
    case 'attendees':
      return 'name'; // Virtual field that combines first_name and last_name
    case 'health_systems':
    case 'conferences':
      return 'name';
    default:
      return 'name';
  }
};

// Helper to safely get an icon for a table
const getTableIcon = (tableName: string | undefined): IconName => {
  if (!tableName) return 'columns';
  
  switch (tableName) {
    case 'attendees':
      return 'user';
    case 'health_systems':
      return 'building';
    case 'conferences':
      return 'calendar';
    default:
      return 'columns';
  }
};

export function useColumnManagement({
  activeTab
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
    
    // Map tab name to entity table name
    const tabToTableName = {
      'attendees': 'attendees',
      'health-systems': 'health_systems',
      'conferences': 'conferences'
    };
    
    const currentEntityTable = tabToTableName[activeTab];
    const mainTables = ['attendees', 'health_systems', 'conferences'];
    
    // 1. Get columns from the current entity table
    const mainTableColumns = dbColumns.filter(col => col.table === currentEntityTable);
    
    // Process main table columns
    mainTableColumns.forEach(col => {
      if (activeTab === 'attendees' && col.id === 'name') {
        fields.push({
          id: 'name',
          label: 'Name',
          iconName: getColumnIconName('name'),
          accessorFn: (row: any) => `${row.first_name} ${row.last_name}`,
          dataType: 'text'
        });
      } else if (activeTab === 'health-systems' && col.id === 'location') {
        fields.push({
          id: 'location',
          label: 'Location',
          iconName: getColumnIconName('location'),
          accessorFn: (row: any) => `${row.city || ''}, ${row.state || ''}`,
          dataType: 'text'
        });
      } else if (activeTab === 'conferences' && col.id === 'date') {
        fields.push({
          id: 'date',
          label: 'Date',
          iconName: getColumnIconName('date'),
          accessorFn: (row: any) => {
            const formatDate = (dateStr: string) => {
              const date = new Date(dateStr);
              return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              });
            };
            
            if (row.start_date && row.end_date) {
              const startDate = formatDate(row.start_date);
              const endDate = formatDate(row.end_date);
              return `${startDate} - ${endDate}`;
            }
            return row.start_date ? formatDate(row.start_date) : '';
          },
          dataType: 'date'
        });
      } else if (col.is_foreign_key && col.foreign_table) {
        // This is a direct foreign key within the main table (e.g., health_system_id in attendees)
        const displayName = col.header;
        
        fields.push({
          id: col.id,
          label: displayName,
          iconName: getTableIcon(col.foreign_table),
          isForeignKey: true,
          foreignTable: col.foreign_table,
          dataType: 'text',
          accessorFn: (row: any) => {
            try {
              const foreignKeyValue = row[col.id]; // row within atendee - to get health system id
              if (!foreignKeyValue) return '';
              
              // Determine the property name for the related entity
              // It might be in different formats depending on how the data was loaded
              const possibleKeys = [
                col.foreign_table ? `${col.foreign_table}` : '', // singular (e.g., health_system)
                col.foreign_table ? `${col.foreign_table}s` : '', // plural (e.g., health_systems)
                col.foreign_table ? col.foreign_table.replace('_', '') : '' // without underscore (e.g., healthsystem)
              ].filter(Boolean); // Remove empty strings

              // NOTE: this accessorFn is called for each row in the original table (i.e. attendees)
              // but we could instead match foreignKeyValue to a row in foreignTable[foreignColumn]
              // and get row[default value]

              // Find the first key that exists in the row
              let relatedEntity = null;
              for (const key of possibleKeys) {
                if (row[key] !== undefined) {
                  relatedEntity = row[key];
                  break;
                }
              }
              
              if (relatedEntity) {
                // Get the display field for this entity type
                const displayField = getDefaultDisplayField(col.foreign_table || '');
                
                if (displayField === 'name' && !relatedEntity.name && relatedEntity.first_name) {
                  // Special case for attendees where we need to combine first and last name
                  return `${relatedEntity.first_name} ${relatedEntity.last_name || ''}`;
                }
                
                return relatedEntity[displayField] || String(foreignKeyValue);
              }
              
              return String(foreignKeyValue); // Return the ID if the entity isn't loaded
            } catch (error) {
              console.error(`Error accessing relationship for ${col.id}:`, error);
              return '';
            }
          }
        });
      } else {
        // Regular column
        fields.push({
          id: col.id,
          label: col.header,
          iconName: getColumnIconName(col.id || ''),
          accessorKey: col.id,
          dataType: col.data_type
        });
      }
    });
    
    // 2. Find junction tables (tables that aren't main tables)
    const junctionTables = dbColumns
      .filter(col => !mainTables.includes(col.table))
      .map(col => col.table)
      .filter((value, index, self) => self.indexOf(value) === index); // Deduplicate
    
    // 3. For each junction table, check if it links to the current entity
    junctionTables.forEach(junctionTable => {
      // Find columns in this junction table that link to the current entity
      const linksToCurrentEntity = dbColumns.some(col => 
        col.table === junctionTable && 
        col.is_foreign_key && 
        col.foreign_table === currentEntityTable
      );
      
      // If this junction table links to our current entity
      if (linksToCurrentEntity) {
        // Find all foreign key columns in this junction table that link to OTHER entities
        const linkedColumns = dbColumns.filter(col => 
          col.table === junctionTable && 
          col.is_foreign_key && 
          col.foreign_table !== currentEntityTable
        );
        
        // Add these linked columns to our fields list
        linkedColumns.forEach(col => {
          if (col.foreign_table) {
            const linkedEntityName = col.foreign_table
              .split('_')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
              
            fields.push({
              id: `${junctionTable}_${col.id}`,
              label: linkedEntityName,
              iconName: getTableIcon(col.foreign_table),
              isForeignKey: true,
              foreignTable: col.foreign_table,
              dataType: 'text',
              accessorFn: (row: any) => {
                // again same approach to do the accessorFn - row of foreigntable[foreignColumn] = row[id]
                // selected row[default value]
                try {
                  // There are multiple ways the junction data might be loaded
                  // Try different property naming patterns
                  const junctionKeys = [
                    `${junctionTable}s`, // plural (e.g., attendee_conferences)
                    junctionTable, // singular
                    junctionTable.replace('_', '') // without underscore
                  ];
                  
                  let junctionItems = null;
                  for (const key of junctionKeys) {
                    if (row[key] && (Array.isArray(row[key]) || typeof row[key] === 'object')) {
                      junctionItems = Array.isArray(row[key]) ? row[key] : [row[key]];
                      break;
                    }
                  }
                  
                  // If no junction data found, return empty string
                  if (!junctionItems || junctionItems.length === 0) {
                    return '';
                  }
                  
                  // The related entity could be under different property names
                  const relatedEntityKeys = [
                    `${col.foreign_table}s`, // plural (e.g., conferences)
                    `${col.foreign_table}`, // singular (e.g., conference)
                    col.foreign_table?.replace('_', '') // without underscore
                  ];
                  
                  // Extract names from linked entities and join with commas
                  const names: string[] = [];
                  
                  junctionItems.forEach(item => {
                    // Try to find the related entity under different key patterns
                    let linkedEntity = null;
                    for (const key of relatedEntityKeys) {
                      if (key && item[key]) {
                        linkedEntity = item[key];
                        break;
                      }
                    }

                    if (linkedEntity) {
                      if (linkedEntity.name) {
                        names.push(linkedEntity.name);
                      } else if (linkedEntity.first_name && linkedEntity.last_name) {
                        names.push(`${linkedEntity.first_name} ${linkedEntity.last_name}`);
                      }
                    }
                  });
                  
                  return names.join(', ');
                } catch (error) {
                  console.error(`Error accessing junction relationship for ${col.id}:`, error);
                  return '';
                }
              }
            });
          }
        });
      }
    });
    
    // 4. Find reverse relationships (one-to-many) - other tables that reference this entity
    // Skip junction tables which we already handled
    mainTables.forEach(otherTable => {
      // Skip the current table
      if (otherTable === currentEntityTable) return;
      
      // Find columns in the other table that reference our current entity
      const referencingColumns = dbColumns.filter(col => 
        col.table === otherTable && 
        col.is_foreign_key && 
        col.foreign_table === currentEntityTable
      );
      
      // If we found any referencing columns
      if (referencingColumns.length > 0) {
        // Format the display name
        const otherEntityName = otherTable
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        
        fields.push({
          id: `reverse_${otherTable}`,
          label: otherEntityName,
          iconName: getTableIcon(otherTable),
          dataType: 'text',
          accessorFn: (row: any) => {
            try {
              // For reverse relationships, we access the array of related entities directly
              const relatedEntityKeys = [
                `${otherTable}s`, // plural (e.g., attendees)
                otherTable, // singular
                otherTable.replace('_', '') // without underscore
              ];
              
              let relatedEntities = null;
              for (const key of relatedEntityKeys) {
                if (row[key]) {
                  relatedEntities = Array.isArray(row[key]) ? row[key] : [row[key]];
                  break;
                }
              }
              
              if (!relatedEntities || relatedEntities.length === 0) {
                return '';
              }
              
              // Get the display field for the other entity
              const displayField = getDefaultDisplayField(otherTable);
              
              // Extract and join names
              const names = relatedEntities.map(entity => {
                if (displayField === 'name' && !entity.name && entity.first_name) {
                  // Special case for attendees
                  return `${entity.first_name} ${entity.last_name || ''}`;
                }
                return entity[displayField] || '';
              }).filter(Boolean);
              
              return names.join(', ');
            } catch (error) {
              console.error(`Error accessing reverse relationship for ${otherTable}:`, error);
              return '';
            }
          }
        });
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
      meta: {
        isForeignKey: field.isForeignKey,
        foreignTable: field.foreignTable,
        dataType: field.dataType
      }
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
    const fields: { id: string, label: string, value: string, iconName: IconName }[] = []
    const visibleColumnIds = visibleColumns[activeTab]
    
    // Skip name as it's shown as the card title
    const visibleFields = fieldsInfo.filter(field => 
      visibleColumnIds.includes(field.id) && field.id !== 'name'
    );
    
    visibleFields.forEach(field => {
      let value = '';
      
      if (field.accessorFn) {

        // Use the accessor function for all fields that have one
        // This is crucial for relationship fields which need custom processing
        value = String(field.accessorFn(item) || '');
      } else if (field.accessorKey) {
        // For direct properties (not relationships)
        value = String((item as any)[field.accessorKey] || '');
      }
      
      fields.push({
        id: field.id,
        label: field.label,
        value,
        iconName: field.iconName
      });
    });
    
    return fields;
  }

  const getFieldsForAllColumns = (item: Attendee | HealthSystem | Conference) => {
    const fields: { id: string, label: string, value: string, iconName: IconName }[] = []
    
    fieldsInfo.forEach(field => {
      let value = '';
      
      if (field.accessorFn) {
        value = String(field.accessorFn(item) || '');
      } else if (field.accessorKey) {
        value = String((item as any)[field.accessorKey] || '');
      }
      
      fields.push({
        id: field.id,
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
    getFieldsForItem,
    getFieldsForAllColumns
  }
} 