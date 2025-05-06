import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { Attendee, HealthSystem, Conference } from '@/types';

/**
 * Property type definitions
 */
export type PropertyType = 
  | 'text' 
  | 'number' 
  | 'date' 
  | 'email' 
  | 'phone' 
  | 'url' 
  | 'relation' 
  | 'multi-relation'
  | 'tags';

/**
 * Interface for entity property definitions
 */
export interface EntityProperty {
  id: string;
  name: string;
  type: PropertyType;
  isVirtual?: boolean;
  relatedEntity?: 'attendees' | 'health_systems' | 'conferences';
  accessorFn?: (entity: any) => any;
  formatFn?: (value: any) => string;
  
  // Database metadata (for dynamic properties)
  isNullable?: boolean;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  referencesTable?: string;
  referencesColumn?: string;
}

/**
 * Database column metadata from Postgres information schema
 */
interface ColumnMetadata {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

/**
 * Foreign key metadata from Postgres information schema
 */
interface ForeignKeyMetadata {
  table_name: string;
  column_name: string;
  foreign_table_name: string;
  foreign_column_name: string;
}

/**
 * EntityProperties interface with property definitions for each entity type
 */
interface EntityProperties {
  attendees: EntityProperty[];
  healthSystems: EntityProperty[];
  conferences: EntityProperty[];
  getPropertiesByEntityType: (entityType: 'attendees' | 'health_systems' | 'conferences') => EntityProperty[];
  getPropertyValue: (entity: any, propertyId: string) => any;
  formatPropertyValue: (value: any, propertyId: string, entityType: 'attendees' | 'health_systems' | 'conferences') => string;
  isLoading: boolean;
  error: string | null;
}

/**
 * Helper to determine property type from PostgreSQL data type
 */
function getPropertyTypeFromDataType(columnName: string, dataType: string): PropertyType {
  // Special handling based on column name
  if (columnName.endsWith('_id')) return 'relation';
  if (columnName === 'email') return 'email';
  if (columnName === 'phone') return 'phone';
  if (columnName.includes('url') || columnName === 'website') return 'url';
  
  // Handle by data type
  switch (dataType) {
    case 'uuid':
    case 'text':
    case 'character varying':
    case 'varchar':
      return 'text';
    case 'integer':
    case 'bigint':
    case 'numeric':
    case 'decimal':
      return 'number';
    case 'timestamp with time zone':
    case 'timestamp without time zone':
    case 'date':
      return 'date';
    case 'ARRAY':
      return 'tags';
    default:
      return 'text';
  }
}

/**
 * Hook to manage entity properties in a Notion-like way
 */
export function useEntityProperties(): EntityProperties {
  const [attendeeProperties, setAttendeeProperties] = useState<EntityProperty[]>([]);
  const [healthSystemProperties, setHealthSystemProperties] = useState<EntityProperty[]>([]);
  const [conferenceProperties, setConferenceProperties] = useState<EntityProperty[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch database schema/columns on mount
  useEffect(() => {
    async function fetchDatabaseSchema() {
      setIsLoading(true);
      setError(null);
      
      try {
        // Implement a timeout to prevent hanging - increase timeout to 15 seconds
        const timeoutPromise = new Promise<null>((_, reject) => {
          setTimeout(() => reject(new Error('Schema fetch timed out')), 15000);
        });
        
        // Create promises for schema fetching
        const columnsPromise = supabase.rpc('get_table_columns', {
          table_names: ['attendees', 'health_systems', 'conferences', 'attendee_conferences']
        });
        
        const foreignKeysPromise = supabase.rpc('get_foreign_keys');
        
        // Race against timeout
        let columnsResult, foreignKeysResult;
        
        try {
          columnsResult = await Promise.race([columnsPromise, timeoutPromise]);
        } catch (err) {
          console.error('Error fetching columns:', err);
          throw new Error('Failed to fetch column metadata');
        }
        
        try {
          foreignKeysResult = await Promise.race([foreignKeysPromise, timeoutPromise]);
        } catch (err) {
          console.error('Error fetching foreign keys:', err);
          throw new Error('Failed to fetch foreign key relationships');
        }
        
        // Type check and handle potential null values
        if (!columnsResult) throw new Error('Failed to fetch column metadata');
        if (!foreignKeysResult) throw new Error('Failed to fetch foreign key relationships');
        
        const { data: columns, error: columnsError } = columnsResult;
        const { data: foreignKeys, error: fkError } = foreignKeysResult;
        
        if (columnsError) throw columnsError;
        if (fkError) throw fkError;
        
        if (!columns || columns.length === 0) {
          throw new Error('No column data returned from database');
        }
        
        // Process column data for each table
        processTableColumns(columns, foreignKeys || []);
      } catch (err) {
        console.error('Error fetching schema:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch database schema');
        
        // Log detailed error for debugging
        console.log('Falling back to default properties due to schema fetch error', {
          errorType: typeof err,
          errorMessage: err instanceof Error ? err.message : 'Unknown error',
          errorStack: err instanceof Error ? err.stack : undefined
        });
        
        // Use hardcoded fallback properties if we can't fetch the schema
        initializeDefaultProperties();
      } finally {
        setIsLoading(false);
      }
    }
    
    /**
     * Process column metadata into property definitions
     */
    function processTableColumns(
      columns: ColumnMetadata[], 
      foreignKeys: ForeignKeyMetadata[]
    ) {
      // Filter columns by table
      const attendeeColumns = columns.filter(col => col.table_name === 'attendees');
      const healthSystemColumns = columns.filter(col => col.table_name === 'health_systems');
      const conferenceColumns = columns.filter(col => col.table_name === 'conferences');
      
      // Process each table's columns
      const attendeeProps = attendeeColumns.map(col => 
        createPropertyFromColumn(col, foreignKeys, 'attendees')
      );
      
      const healthSystemProps = healthSystemColumns.map(col => 
        createPropertyFromColumn(col, foreignKeys, 'health_systems')
      );
      
      const conferenceProps = conferenceColumns.map(col => 
        createPropertyFromColumn(col, foreignKeys, 'conferences')
      );
      
      // Add virtual properties
      const attendeeFinalProps = [
        ...attendeeProps,
        // Virtual name property (combining first_name and last_name)
        {
          id: 'name',
          name: 'Name',
          type: 'text' as PropertyType,
          isVirtual: true,
          accessorFn: (attendee: Attendee) => `${attendee.first_name} ${attendee.last_name}`,
        },
        // Conferences multi-relation property
        {
          id: 'conferences',
          name: 'Conferences',
          type: 'multi-relation' as PropertyType,
          relatedEntity: 'conferences' as const,
          isVirtual: true,
          accessorFn: (attendee: Attendee) => {
            // Safety check for null/undefined
            if (!attendee || !attendee.attendee_conferences) {
              return '';
            }
            
            try {
              return attendee.attendee_conferences
                .filter(ac => ac && ac.conferences) // Filter out any null/undefined conferences
                .map(ac => {
                  return ac.conferences?.name || 'Unknown'
                })
                .join(', ') || '';
            } catch (err) {
              console.error('Error in conferences accessorFn:', err);
              return 'Error loading conferences';
            }
          },
        }
      ];
      
      const healthSystemFinalProps = [
        ...healthSystemProps,
        // Location virtual property
        {
          id: 'location',
          name: 'Location',
          type: 'text' as PropertyType,
          isVirtual: true,
          accessorFn: (hs: HealthSystem) => 
            [hs.city, hs.state].filter(Boolean).join(', '),
        },
        // Attendees multi-relation virtual property
        {
          id: 'attendees',
          name: 'Attendees',
          type: 'multi-relation' as PropertyType,
          relatedEntity: 'attendees' as const,
          isVirtual: true,
        }
      ];
      
      const conferenceFinalProps = [
        ...conferenceProps,
        // Date range virtual property
        {
          id: 'date',
          name: 'Date',
          type: 'text' as PropertyType,
          isVirtual: true,
          accessorFn: (conference: Conference) => {
            if (!conference.start_date) return '';
            const start = new Date(conference.start_date).toLocaleDateString();
            return conference.end_date 
              ? `${start} - ${new Date(conference.end_date).toLocaleDateString()}`
              : start;
          },
        },
        // Attendees multi-relation virtual property
        {
          id: 'attendees',
          name: 'Attendees',
          type: 'multi-relation' as PropertyType,
          relatedEntity: 'attendees' as const,
          isVirtual: true,
        }
      ];
      
      // Update state with processed properties
      setAttendeeProperties(attendeeFinalProps);
      setHealthSystemProperties(healthSystemFinalProps);
      setConferenceProperties(conferenceFinalProps);
    }
    
    /**
     * Create an EntityProperty from a database column
     */
    function createPropertyFromColumn(
      column: ColumnMetadata, 
      foreignKeys: ForeignKeyMetadata[],
      tableName: string
    ): EntityProperty {
      // Check if column is a foreign key
      const foreignKey = foreignKeys.find(
        fk => fk.table_name === column.table_name && fk.column_name === column.column_name
      );
      
      const isForeignKey = !!foreignKey;
      
      // Format the display name (e.g., "first_name" -> "First Name")
      const displayName = column.column_name
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      // Get property type based on data type and column name
      let propertyType = getPropertyTypeFromDataType(column.column_name, column.data_type);
      
      // For foreign keys, use relation type
      if (isForeignKey) {
        propertyType = 'relation';
      }
      
      // Create property definition
      const property: EntityProperty = {
        id: column.column_name,
        name: displayName,
        type: propertyType,
        isNullable: column.is_nullable === 'YES',
        isPrimaryKey: column.column_name === 'id',
        isForeignKey,
      };
      
      // Add foreign key metadata if applicable
      if (isForeignKey && foreignKey) {
        // Cast the foreign table name to the expected type
        const relatedEntityType = (foreignKey.foreign_table_name === 'attendees' || 
          foreignKey.foreign_table_name === 'health_systems' || 
          foreignKey.foreign_table_name === 'conferences') 
          ? foreignKey.foreign_table_name 
          : undefined;
          
        property.relatedEntity = relatedEntityType;
        property.referencesTable = foreignKey.foreign_table_name;
        property.referencesColumn = foreignKey.foreign_column_name;
      }
      
      // Add formatters for specific types
      if (property.type === 'date') {
        property.formatFn = (value: string) => value ? new Date(value).toLocaleDateString() : '';
      } else if (property.type === 'tags' && property.id === 'certifications') {
        property.formatFn = (value: string[]) => value?.join(', ') || '';
      }
      
      return property;
    }
    
    /**
     * Initialize with hardcoded properties as fallback
     */
    function initializeDefaultProperties() {
      // Default attendee properties
      setAttendeeProperties([
        {
          id: 'name',
          name: 'Name',
          type: 'text',
          isVirtual: true,
          accessorFn: (attendee: Attendee) => `${attendee.first_name} ${attendee.last_name}`,
        },
        {
          id: 'first_name',
          name: 'First Name',
          type: 'text',
        },
        {
          id: 'last_name',
          name: 'Last Name',
          type: 'text',
        },
        {
          id: 'email',
          name: 'Email',
          type: 'email',
        },
        {
          id: 'phone',
          name: 'Phone',
          type: 'phone',
        },
        {
          id: 'title',
          name: 'Title',
          type: 'text',
        },
        {
          id: 'company',
          name: 'Company',
          type: 'text',
        },
        {
          id: 'certifications',
          name: 'Certifications',
          type: 'tags',
          formatFn: (value: string[]) => value?.join(', ') || '',
        },
        {
          id: 'linkedin_url',
          name: 'LinkedIn',
          type: 'url',
        },
        {
          id: 'notes',
          name: 'Notes',
          type: 'text',
        },
        {
          id: 'health_system_id',
          name: 'Health System',
          type: 'relation',
          relatedEntity: 'health_systems' as const,
          accessorFn: (attendee: Attendee) => attendee.health_systems?.name || '',
        },
        {
          id: 'conferences',
          name: 'Conferences',
          type: 'multi-relation',
          relatedEntity: 'conferences' as const,
          isVirtual: true,
          accessorFn: (attendee: Attendee) => 
            attendee.attendee_conferences?.map(ac => ac.conferences?.name || 'Unknown').join(', ') || '',
        },
        {
          id: 'created_at',
          name: 'Created',
          type: 'date',
          formatFn: (value: string) => new Date(value).toLocaleDateString(),
        },
        {
          id: 'updated_at',
          name: 'Updated',
          type: 'date',
          formatFn: (value: string) => new Date(value).toLocaleDateString(),
        },
      ] as EntityProperty[]);
      
      // Default health system properties
      setHealthSystemProperties([
        {
          id: 'name',
          name: 'Name',
          type: 'text',
        },
        {
          id: 'website',
          name: 'Website',
          type: 'url',
        },
        {
          id: 'address',
          name: 'Address',
          type: 'text',
        },
        {
          id: 'city',
          name: 'City',
          type: 'text',
        },
        {
          id: 'state',
          name: 'State',
          type: 'text',
        },
        {
          id: 'zip',
          name: 'ZIP',
          type: 'text',
        },
        {
          id: 'location',
          name: 'Location',
          type: 'text',
          isVirtual: true,
          accessorFn: (hs: HealthSystem) => 
            [hs.city, hs.state].filter(Boolean).join(', '),
        },
        {
          id: 'attendees',
          name: 'Attendees',
          type: 'multi-relation',
          relatedEntity: 'attendees' as const,
          isVirtual: true,
        },
        {
          id: 'created_at',
          name: 'Created',
          type: 'date',
          formatFn: (value: string) => new Date(value).toLocaleDateString(),
        },
      ] as EntityProperty[]);
      
      // Default conference properties
      setConferenceProperties([
        {
          id: 'name',
          name: 'Name',
          type: 'text',
        },
        {
          id: 'start_date',
          name: 'Start Date',
          type: 'date',
          formatFn: (value: string) => value ? new Date(value).toLocaleDateString() : '',
        },
        {
          id: 'end_date',
          name: 'End Date',
          type: 'date',
          formatFn: (value: string) => value ? new Date(value).toLocaleDateString() : '',
        },
        {
          id: 'date',
          name: 'Date',
          type: 'text',
          isVirtual: true,
          accessorFn: (conference: Conference) => {
            if (!conference.start_date) return '';
            const start = new Date(conference.start_date).toLocaleDateString();
            return conference.end_date 
              ? `${start} - ${new Date(conference.end_date).toLocaleDateString()}`
              : start;
          },
        },
        {
          id: 'location',
          name: 'Location',
          type: 'text',
        },
        {
          id: 'attendees',
          name: 'Attendees',
          type: 'multi-relation',
          relatedEntity: 'attendees' as const,
          isVirtual: true,
        },
        {
          id: 'created_at',
          name: 'Created',
          type: 'date',
          formatFn: (value: string) => new Date(value).toLocaleDateString(),
        },
      ] as EntityProperty[]);
    }
    
    // Fetch database schema on mount
    fetchDatabaseSchema();
  }, []);

  // Get properties by entity type
  const getPropertiesByEntityType = (entityType: 'attendees' | 'health_systems' | 'conferences'): EntityProperty[] => {
    switch (entityType) {
      case 'attendees':
        return attendeeProperties;
      case 'health_systems':
        return healthSystemProperties;
      case 'conferences':
        return conferenceProperties;
      default:
        return [];
    }
  };

  // Get a property value for an entity
  const getPropertyValue = (entity: any, propertyId: string): any => {
    if (!entity) return null;
    
    let entityType: 'attendees' | 'health_systems' | 'conferences';
    
    // Determine entity type
    if ('first_name' in entity && 'last_name' in entity) {
      entityType = 'attendees';
    } else if ('start_date' in entity) {
      entityType = 'conferences';
    } else {
      entityType = 'health_systems';
    }
    
    // Get properties for this entity type
    const properties = getPropertiesByEntityType(entityType);
    
    // Find the property definition
    const propertyDef = properties.find(p => p.id === propertyId);
    if (!propertyDef) return entity[propertyId];
    
    // Use accessor function if defined
    if (propertyDef.accessorFn) {
      return propertyDef.accessorFn(entity);
    }
    
    // Otherwise return the direct property value
    return entity[propertyId];
  };

  // Format a property value
  const formatPropertyValue = (value: any, propertyId: string, entityType: 'attendees' | 'health_systems' | 'conferences'): string => {
    if (value === null || value === undefined) return '';
    
    // Get property definition
    const properties = getPropertiesByEntityType(entityType);
    const propertyDef = properties.find(p => p.id === propertyId);
    
    // If no property definition found, return string value
    if (!propertyDef) return String(value);
    
    // Use format function if defined
    if (propertyDef.formatFn) {
      return propertyDef.formatFn(value);
    }
    
    // Default formatting by type
    switch (propertyDef.type) {
      case 'date':
        return value ? new Date(value).toLocaleDateString() : '';
      case 'tags':
        return Array.isArray(value) ? value.join(', ') : String(value);
      default:
        return String(value || '');
    }
  };

  return {
    attendees: attendeeProperties,
    healthSystems: healthSystemProperties,
    conferences: conferenceProperties,
    getPropertiesByEntityType,
    getPropertyValue,
    formatPropertyValue,
    isLoading,
    error
  };
} 