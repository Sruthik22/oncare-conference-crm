import type { Attendee, HealthSystem, Conference } from '@/types'
import type { ColumnMetadata } from '@/hooks/useColumnMetadata'

/**
 * Gets a display name from an entity object
 */
export function getEntityDisplayName(entity: any): string {
  if (!entity) return ''
  
  if ('name' in entity) return entity.name
  if ('first_name' in entity) return `${entity.first_name} ${entity.last_name || ''}`
  
  return '[Object]'
}

/**
 * Formats a table name for display (e.g., "health_systems" -> "Health Systems")
 */
export function formatTableName(tableName: string): string {
  return tableName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Gets field label for relationship fields
 */
export function getRelationshipLabel(
  fieldId: string, 
  referencesTable?: string,
  tableType?: string
): string {
  // Special cases for specific relationships
  if (fieldId === 'attendees' && tableType === 'health_systems') {
    return 'Attendees'
  }
  
  if (fieldId === 'attendee_conferences' && tableType === 'conferences') {
    return 'Attendees'
  }
  
  if (fieldId.endsWith('_id') && referencesTable) {
    // Format for foreign keys: "Health System" instead of "Health System Id"
    const baseField = fieldId.replace(/_id$/, '')
    return `${formatFieldName(baseField)}`
  }
  
  if (fieldId.includes('_')) {
    // For junction tables (e.g., "attendee_conferences" -> "Conferences")
    const parts = fieldId.split('_')
    // Skip the first part (current entity type) and format the rest
    return parts.slice(1)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }
  
  return formatFieldName(fieldId)
}

/**
 * Formats a field name for display (snake_case to Title Case)
 */
export function formatFieldName(fieldName: string): string {
  return fieldName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Gets a value from a relationship field
 */
export function getRelationshipValue(
  value: any,
  fieldId: string,
  columnInfo?: ColumnMetadata,
  allData?: {
    attendees: Attendee[],
    healthSystems: HealthSystem[],
    conferences: Conference[]
  }
): string {
  // Handle boolean values
  if (typeof value === 'boolean') {
    return value ? 'True' : 'False'
  }
  
  // Handle array relationships (one-to-many, many-to-many)
  if (Array.isArray(value)) {
    const relations = value as any[]
    
    if (relations.length === 0) return '-'
    
    // Handle primitive arrays (like string[] for certifications)
    // Check if all elements are primitive types
    if (relations.every(item => typeof item !== 'object' || item === null)) {
      return relations.join(', ')
    }
    
    // Health system -> attendees relationship (show attendee names)
    if (fieldId === 'attendees' && columnInfo?.table === 'health_systems') {
      return relations
        .map(attendee => {
          if ('first_name' in attendee && 'last_name' in attendee) {
            return `${attendee.first_name} ${attendee.last_name || ''}`.trim()
          }
          return null
        })
        .filter(Boolean)
        .join(', ') || '-'
    }
    
    // If this is a junction table, extract values from related entities
    if (fieldId.includes('_') && relations[0]) {
      const parts = fieldId.split('_')
      const targetEntity = parts[parts.length - 1] // e.g., "conferences"
      
      // Special case for attendee_conferences in conferences table
      if (fieldId === 'attendee_conferences' && columnInfo?.table === 'conferences') {
        // Extract attendee names from the nested attendees object
        return relations
          .map(rel => {
            if (rel.attendees && typeof rel.attendees === 'object') {
              // Handle when attendees is a single object
              if ('first_name' in rel.attendees) {
                return `${rel.attendees.first_name} ${rel.attendees.last_name || ''}`.trim()
              }
              return null
            }
            return null
          })
          .filter(Boolean)
          .join(', ') || '-'
      }
      
      if (relations[0][targetEntity]) {
        // Extract entity names
        return relations
          .map(rel => {
            const target = rel[targetEntity]
            if (!target) return null
            return getEntityDisplayName(target)
          })
          .filter(Boolean)
          .join(', ')
      }
    }
    
    // Default to showing count
    return `${relations.length} item(s)`
  }
  
  // Handle object relationships (one-to-one, many-to-one)
  if (value && typeof value === 'object') {
    return getEntityDisplayName(value)
  }
  
  // Handle UUID foreign keys
  if (typeof value === 'string' && 
      columnInfo?.is_foreign_key && 
      columnInfo.references_table && 
      allData) {
    
    // Find the referenced entity collection
    const entities = 
      columnInfo.references_table === 'health_systems' ? allData.healthSystems :
      columnInfo.references_table === 'conferences' ? allData.conferences :
      columnInfo.references_table === 'attendees' ? allData.attendees :
      null
    
    if (entities) {
      const entity = entities.find(e => e.id === value)
      if (entity) {
        return getEntityDisplayName(entity)
      }
    }
  }
  
  // Default: just return the value as a string
  return String(value || '')
} 