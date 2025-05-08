import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface ColumnMetadata {
  name: string;
  data_type: string;
  table: string;
  description?: string;
  is_nullable: boolean;
  is_foreign_key?: boolean;
  references_table?: string;
  references_column?: string;
  display_column?: string; // Column to display in the referenced table (e.g., "name")
}

export interface RelationshipMetadata {
  table: string;
  column: string;
  foreign_table: string;
  foreign_column: string;
  junction_table?: string;
  display_column?: string; // The default display column for the related table
}

export function useColumnMetadata() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [columnMetadata, setColumnMetadata] = useState<{
    attendees: ColumnMetadata[];
    health_systems: ColumnMetadata[];
    conferences: ColumnMetadata[];
  }>({
    attendees: [],
    health_systems: [],
    conferences: []
  });
  const [relationships, setRelationships] = useState<RelationshipMetadata[]>([]);

  useEffect(() => {
    async function fetchColumnMetadata() {
      try {
        setLoading(true);

        // Create timeout promise
        const timeoutPromise = new Promise<null>((_, reject) => {
          setTimeout(() => reject(new Error('Column metadata fetch timed out')), 15000);
        });

        // Get metadata for attendees table with timeout
        let attendeesData = null, attendeesError = null;
        try {
          const attendeesPromise = supabase
            .from('attendees')
            .select('*, health_systems(*), attendee_conferences(*, conferences(*))')
            .limit(1);
          
          const attendeesResult = await Promise.race([attendeesPromise, timeoutPromise]);
          if (attendeesResult) {
            attendeesData = attendeesResult.data;
            attendeesError = attendeesResult.error;
          }
        } catch (err) {
          console.error("Error fetching attendees data:", err);
          attendeesError = new Error(err instanceof Error ? err.message : 'Unknown error');
        }

        console.log("attendeesData", attendeesData);

        // Get metadata for health_systems table with timeout
        let healthSystemsData = null, healthSystemsError = null;
        try {
          const healthSystemsPromise = supabase
            .from('health_systems')
            .select('*, attendees(*)')
            .limit(1);
          
          const healthSystemsResult = await Promise.race([healthSystemsPromise, timeoutPromise]);
          if (healthSystemsResult) {
            healthSystemsData = healthSystemsResult.data;
            healthSystemsError = healthSystemsResult.error;
          }
        } catch (err) {
          console.error("Error fetching health systems data:", err);
          healthSystemsError = new Error(err instanceof Error ? err.message : 'Unknown error');
        }

        console.log("healthSystemsData", healthSystemsData);

        // Get metadata for conferences table with timeout
        let conferencesData = null, conferencesError = null;
        try {
          const conferencesPromise = supabase
            .from('conferences')
            .select('*, attendee_conferences(*, attendees(*))')
            .limit(1);
          
          const conferencesResult = await Promise.race([conferencesPromise, timeoutPromise]);
          if (conferencesResult) {
            conferencesData = conferencesResult.data;
            conferencesError = conferencesResult.error;
          }
        } catch (err) {
          console.error("Error fetching conferences data:", err);
          conferencesError = new Error(err instanceof Error ? err.message : 'Unknown error');
        }

        console.log("conferencesData", conferencesData);

        if (attendeesError || healthSystemsError || conferencesError) {
          throw new Error(attendeesError?.message || healthSystemsError?.message || conferencesError?.message);
        }

        // Define display columns for each table
        const displayColumns: Record<string, string> = {
          attendees: 'name', // Virtual column combining first_name and last_name
          health_systems: 'name',
          conferences: 'name',
          attendee_conferences: 'id' // Junction table typically doesn't have a natural display column
        };

        // Collect relationships based on the data structure
        const relationshipsList: RelationshipMetadata[] = [];

        // Process main tables to extract their relationships
        if (attendeesData && attendeesData.length > 0) {
          const sample = attendeesData[0];
          
          // Direct foreign key to health_systems
          if ('health_system_id' in sample) {
            relationshipsList.push({
              table: 'attendees',
              column: 'health_system_id',
              foreign_table: 'health_systems',
              foreign_column: 'id',
              display_column: 'name'
            });
          }
          
          // Many-to-many relationship with conferences through attendee_conferences
          if ('attendee_conferences' in sample) {
            relationshipsList.push({
              table: 'attendees',
              column: 'id',
              foreign_table: 'conferences',
              foreign_column: 'id',
              junction_table: 'attendee_conferences',
              display_column: 'name'
            });

            // Also add relationship for the junction table
            relationshipsList.push({
              table: 'attendee_conferences',
              column: 'conference_id',
              foreign_table: 'conferences',
              foreign_column: 'id',
              display_column: 'name'
            });

            relationshipsList.push({
              table: 'attendee_conferences',
              column: 'attendee_id',
              foreign_table: 'attendees',
              foreign_column: 'id',
              display_column: 'name'
            });
          }
        }
        
        if (conferencesData && conferencesData.length > 0) {
          const sample = conferencesData[0];
          
          // Console log the sample structure
          console.log('Conference sample with attendee_conferences:', sample);
          
          // Many-to-many relationship with attendees through attendee_conferences
          if ('attendee_conferences' in sample) {
            // Log the first attendee_conference record
            if (Array.isArray(sample.attendee_conferences) && sample.attendee_conferences.length > 0) {
              console.log('First attendee_conference record:', sample.attendee_conferences[0]);
            }
            
            relationshipsList.push({
              table: 'conferences',
              column: 'id',
              foreign_table: 'attendees',
              foreign_column: 'id',
              junction_table: 'attendee_conferences',
              display_column: 'name'
            });
          }
        }

        if (healthSystemsData && healthSystemsData.length > 0) {
          const sample = healthSystemsData[0];

          console.log('Health system sample with attendees:', sample);
          
          // One-to-many relationship with attendees
          if ('attendees' in sample) {
            relationshipsList.push({
              table: 'health_systems',
              column: 'id',
              foreign_table: 'attendees',
              foreign_column: 'health_system_id',
              display_column: 'name'
            });
          }
        }

        setRelationships(relationshipsList);

        // Extract column names from the sample data
        const attendeesColumns = attendeesData && attendeesData.length > 0
          ? processColumnsWithRelationships(attendeesData[0], 'attendees', relationshipsList, displayColumns)
          : [];

        const healthSystemsColumns = healthSystemsData && healthSystemsData.length > 0
          ? processColumnsWithRelationships(healthSystemsData[0], 'health_systems', relationshipsList, displayColumns)
          : [];

        const conferencesColumns = conferencesData && conferencesData.length > 0
          ? processColumnsWithRelationships(conferencesData[0], 'conferences', relationshipsList, displayColumns)
          : [];

        setColumnMetadata({
          attendees: attendeesColumns,
          health_systems: healthSystemsColumns,
          conferences: conferencesColumns
        });
      } catch (err: any) {
        console.error('Error fetching column metadata:', err);
        setError(err.message);
        
        // Set fallback empty metadata in case of error
        setColumnMetadata({
          attendees: [],
          health_systems: [],
          conferences: []
        });
      } finally {
        setLoading(false);
      }
    }

    // Process columns and add relationship information
    function processColumnsWithRelationships(
      data: Record<string, any>, 
      tableName: string,
      relationships: RelationshipMetadata[],
      displayColumns: Record<string, string>
    ): ColumnMetadata[] {
      return Object.keys(data)
        .filter(key => !key.includes('.')) // Filter out joined fields with dot notation
        .map(name => {
          const value = data[name];
          const isArray = Array.isArray(value);
          
          // Check if this is a UUID (foreign key) by looking at the column name and pattern
          const isUuid = 
            typeof value === 'string' && 
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
          
          const isForeignKey = (name.endsWith('_id') || isUuid) || relationships.some(r => 
            r.table === tableName && r.column === name
          );
          
          // Find relationship info if available
          const relationship = relationships.find(r => 
            r.table === tableName && (r.column === name || (name.endsWith('_id') && r.column === 'id'))
          );
          
          // If it's an array of objects, it's likely a one-to-many or many-to-many relationship
          let referencesTable: string | undefined = undefined;
          let displayColumn: string | undefined = undefined;
          let isPrimitiveArray = false;
          
          if (isArray) {
            // Check if it's a primitive array (like string[])
            if (value.length > 0 && (typeof value[0] !== 'object' || value[0] === null)) {
              isPrimitiveArray = true;
            } 
            // Check if it's a relationship array
            else if (value.length > 0 && typeof value[0] === 'object') {
              referencesTable = name; // The array name is typically the table name (e.g., attendee_conferences)
              
              // Check if there's a relationship defined for this table
              const tableRelationship = relationships.find(r => r.table === referencesTable);
              if (tableRelationship) {
                displayColumn = tableRelationship.display_column || displayColumns[referencesTable];
              } else {
                // Default display column for the referenced table
                displayColumn = displayColumns[referencesTable] || 'name';
              }
            }
          } else if (isForeignKey && name.endsWith('_id')) {
            // Extract table name from the ID field (e.g., health_system_id -> health_systems)
            const inferredTable = name.replace(/_id$/, '');
            // Check if we should pluralize
            const pluralTable = inferredTable.endsWith('s') ? inferredTable : `${inferredTable}s`;
            
            referencesTable = relationship?.foreign_table || pluralTable;
            displayColumn = relationship?.display_column || displayColumns[referencesTable];
          }
          
          return {
            name,
            data_type: isPrimitiveArray ? 'primitive_array' : isArray ? 'array' : isUuid ? 'uuid' : typeof value,
            table: tableName,
            is_nullable: value === null,
            is_foreign_key: isForeignKey && !isPrimitiveArray,
            references_table: referencesTable,
            references_column: relationship?.foreign_column || 'id',
            display_column: displayColumn
          };
        });
    }

    fetchColumnMetadata();
  }, []);

  return {
    columnMetadata,
    relationships,
    loading,
    error
  };
} 