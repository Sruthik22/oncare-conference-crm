import { useMemo } from 'react'
import type { Attendee, HealthSystem, Conference } from '@/types'

type FilterOperator = 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'is_empty' | 'is_not_empty' | 'greater_than' | 'less_than'

interface Filter {
  id: string
  property: string
  operator: FilterOperator
  value: string
}

interface UseFilteringProps<T> {
  data: T[]
  searchTerm: string
  activeFilters: Filter[]
}

export function useFiltering<T extends Attendee | HealthSystem | Conference>({
  data,
  searchTerm,
  activeFilters,
}: UseFilteringProps<T>) {
  const filteredData = useMemo(() => {
    return data.filter(item => {
      const searchMatch = !searchTerm || 
        (('first_name' in item && 'last_name' in item) 
          ? `${item.first_name} ${item.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
          : 'name' in item 
            ? item.name.toLowerCase().includes(searchTerm.toLowerCase())
            : false) ||
        ('email' in item && item.email?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        ('company' in item && item.company?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        ('city' in item && item.city?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        ('location' in item && item.location?.toLowerCase().includes(searchTerm.toLowerCase()))
      
      const filterMatch = activeFilters.every(filter => {
        const value = filter.property === 'name' && 'first_name' in item && 'last_name' in item
          ? `${item.first_name} ${item.last_name}`
          : item[filter.property as keyof T]

        if (typeof value === 'undefined') return true

        switch (filter.operator) {
          case 'equals':
            return String(value).toLowerCase() === filter.value.toLowerCase()
          case 'contains':
            return String(value).toLowerCase().includes(filter.value.toLowerCase())
          case 'starts_with':
            return String(value).toLowerCase().startsWith(filter.value.toLowerCase())
          case 'ends_with':
            return String(value).toLowerCase().endsWith(filter.value.toLowerCase())
          case 'is_empty':
            return !value || String(value).trim() === ''
          case 'is_not_empty':
            return value && String(value).trim() !== ''
          case 'greater_than':
            return new Date(String(value)) > new Date(filter.value)
          case 'less_than':
            return new Date(String(value)) < new Date(filter.value)
          default:
            return true
        }
      })
      
      return searchMatch && filterMatch
    })
  }, [data, searchTerm, activeFilters])

  return filteredData
} 