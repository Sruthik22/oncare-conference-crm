import { useMemo } from 'react'
import type { Attendee, HealthSystem, Conference } from '@/types'
import type { IconName } from '@/hooks/useColumnManagement'

type FilterOperator = 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'is_empty' | 'is_not_empty' | 'greater_than' | 'less_than'

interface Filter {
  id: string
  property: string
  operator: FilterOperator
  value: string
}

interface UseFilteringProps<T> {
  data: T[]
  searchTerm?: string
  activeFilters: Filter[]
  getFieldsForAllColumns: (item: T) => Array<{ id: string, label: string, value: string, iconName: IconName }>
}

export function useFiltering<T extends Attendee | HealthSystem | Conference>({
  data,
  searchTerm = '',
  activeFilters,
  getFieldsForAllColumns
}: UseFilteringProps<T>) {
  const filteredData = useMemo(() => {
    if (activeFilters.length === 0 && !searchTerm) {
      return data;
    }

    return data.filter(item => {
      let searchMatch = !searchTerm;
      
      if (searchTerm) {
        // Use all fields for search, not just visible ones
        const allFields = getFieldsForAllColumns(item);
        const lowerSearchTerm = searchTerm.toLowerCase();
        
        for (const field of allFields) {
          if (!field.value) continue;
          
          if (field.value.includes(',')) {
            const parts = field.value.split(',').map(part => part.trim().toLowerCase());
            if (parts.some(part => part.includes(lowerSearchTerm))) {
              searchMatch = true;
              break;
            }
          } else if (field.value.toLowerCase().includes(lowerSearchTerm)) {
            searchMatch = true;
            break;
          }
        }
      }
      
      if (activeFilters.length === 0) {
        return searchMatch;
      }
      
      if (!getFieldsForAllColumns) {
        return searchMatch;
      }
      
      // Use all fields to build a complete map for filtering
      const allFields = getFieldsForAllColumns(item);
      
      // Create a map using column IDs as keys for direct lookup
      const fieldMap = new Map();
      allFields.forEach(field => {
        // Use field.id as the key since filter.property contains column IDs
        fieldMap.set(field.id.toLowerCase(), field.value);
      });
      
      const filterMatch = activeFilters.every(filter => {
        const fieldLookupKey = filter.property.toLowerCase();
        let value = fieldMap.get(fieldLookupKey);
        
        if (value === undefined) return true;
        
        return evaluateFilter(filter, value);
      });
      
      return searchMatch && filterMatch;
    });
  }, [data, searchTerm, activeFilters, getFieldsForAllColumns]);

  return filteredData;
}

function evaluateFilter(filter: Filter, value: any): boolean {
  if (value === undefined || value === null) {
    if (filter.operator === 'is_empty') return true;
    if (filter.operator === 'is_not_empty') return false;
    return true;
  }
  
  const stringValue = String(value);
  
  switch (filter.operator) {
    case 'equals':
      if (stringValue.includes(',')) {
        const parts = stringValue.split(',').map(part => part.trim().toLowerCase());
        return parts.some(part => part === filter.value.toLowerCase());
      }
      
      if (stringValue === 'true' || stringValue === 'false') {
        return stringValue === filter.value.toLowerCase();
      }
      
      return stringValue.toLowerCase() === filter.value.toLowerCase();
      
    case 'contains':
      if (stringValue.includes(',')) {
        const parts = stringValue.split(',').map(part => part.trim().toLowerCase());
        return parts.some(part => part.includes(filter.value.toLowerCase()));
      }
      return stringValue.toLowerCase().includes(filter.value.toLowerCase());
      
    case 'starts_with':
      if (stringValue.includes(',')) {
        const parts = stringValue.split(',').map(part => part.trim().toLowerCase());
        return parts.some(part => part.startsWith(filter.value.toLowerCase()));
      }
      return stringValue.toLowerCase().startsWith(filter.value.toLowerCase());
      
    case 'ends_with':
      if (stringValue.includes(',')) {
        const parts = stringValue.split(',').map(part => part.trim().toLowerCase());
        return parts.some(part => part.endsWith(filter.value.toLowerCase()));
      }
      return stringValue.toLowerCase().endsWith(filter.value.toLowerCase());
      
    case 'is_empty':
      return !stringValue || stringValue.trim() === '';
      
    case 'is_not_empty':
      return Boolean(stringValue && stringValue.trim() !== '');
      
    case 'greater_than':
      try {
        if (stringValue.includes('-') && /\d{4}-\d{2}-\d{2}/.test(stringValue)) {
          return new Date(stringValue) > new Date(filter.value);
        } else if (!isNaN(Number(stringValue)) && !isNaN(Number(filter.value))) {
          return Number(stringValue) > Number(filter.value);
        }
        return stringValue > filter.value;
      } catch (e) {
        return false;
      }
      
    case 'less_than':
      try {
        if (stringValue.includes('-') && /\d{4}-\d{2}-\d{2}/.test(stringValue)) {
          return new Date(stringValue) < new Date(filter.value);
        } else if (!isNaN(Number(stringValue)) && !isNaN(Number(filter.value))) {
          return Number(stringValue) < Number(filter.value);
        }
        return stringValue < filter.value;
      } catch (e) {
        return false;
      }
      
    default:
      return true;
  }
} 