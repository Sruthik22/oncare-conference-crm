import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface ColumnData {
  table_name: string
  column_name: string
  data_type: string
  is_nullable: string
  column_default: string | null
}

interface ForeignKeyData {
  table_name: string
  column_name: string
  foreign_table_name: string
  foreign_column_name: string
}

export interface DatabaseColumn {
  id: string
  header: string
  table: string
  data_type: string
  is_nullable: boolean
  is_foreign_key: boolean
  foreign_table?: string
  foreign_column?: string
}

/**
 * Hook to fetch database schema information for all tables
 */
export function useDatabaseSchema() {
  const [columns, setColumns] = useState<DatabaseColumn[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDatabaseSchema() {
      setLoading(true)
      setError(null)

      try {
        // TODO: get all of the tables that we need
        // Fetch columns from all relevant tables
        const { data: columnData, error: columnsError } = await supabase.rpc('get_table_columns', {
          table_names: ['attendees', 'health_systems', 'conferences', 'attendee_conferences']
        })

        if (columnsError) throw columnsError
        if (!columnData || columnData.length === 0) {
          throw new Error('No column data returned from database')
        }

        // Fetch foreign key relationships
        const { data: foreignKeyData, error: fkError } = await supabase.rpc('get_foreign_keys')
        if (fkError) throw fkError

        // Transform the raw data into a more usable format
        const transformedColumns: DatabaseColumn[] = columnData.map((col: ColumnData) => {
          // Format display name (e.g., "first_name" -> "First Name")
          const displayName = col.column_name
            .split('_')
            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')

          // Check if this column is a foreign key
          const foreignKey = foreignKeyData?.find(
            (fk: ForeignKeyData) => fk.table_name === col.table_name && fk.column_name === col.column_name
          )

          return {
            id: col.column_name,
            header: displayName,
            table: col.table_name,
            data_type: col.data_type,
            is_nullable: col.is_nullable === 'YES',
            is_foreign_key: !!foreignKey,
            foreign_table: foreignKey?.foreign_table_name,
            foreign_column: foreignKey?.foreign_column_name
          }
        })

        // Add virtual columns
        const virtualColumns: DatabaseColumn[] = [
          // Attendee name (combination of first_name and last_name)
          {
            id: 'name',
            header: 'Name',
            table: 'attendees',
            data_type: 'text',
            is_nullable: false,
            is_foreign_key: false
          },
          // Date range for conferences
          {
            id: 'date',
            header: 'Date',
            table: 'conferences',
            data_type: 'date',
            is_nullable: true,
            is_foreign_key: false
          },
          // Location for health systems (combination of city and state)
          {
            id: 'location',
            header: 'Location',
            table: 'health_systems',
            data_type: 'text',
            is_nullable: true,
            is_foreign_key: false
          }
        ]

        setColumns([...transformedColumns, ...virtualColumns])
      } catch (err) {
        console.error('Error fetching database schema:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch database schema')
      } finally {
        setLoading(false)
      }
    }

    fetchDatabaseSchema()
  }, [])

  /**
   * Filter columns by entity type
   */
  const getColumnsByTable = (tableName: string) => {
    return columns.filter(col => col.table === tableName)
  }

  return {
    columns,
    loading,
    error,
    getColumnsByTable,
    // Helper functions for specific entities
    getAttendeeColumns: () => getColumnsByTable('attendees'),
    getHealthSystemColumns: () => getColumnsByTable('health_systems'),
    getConferenceColumns: () => getColumnsByTable('conferences')
  }
} 