// Check file contents 

// Base entity interface that all entities extend
interface BaseEntity {
  id: string
  created_at?: string
  updated_at?: string
}

// Health System entity
export interface HealthSystem extends BaseEntity {
  name: string
  definitive_id?: string
  website?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  // Relationships
  attendees?: Attendee[]
}

// Conference entity
export interface Conference extends BaseEntity {
  name: string
  start_date: string
  end_date?: string
  location?: string
  // Relationships
  attendee_conferences?: AttendeeConference[]
}

// Attendee Conference join table
export interface AttendeeConference {
  id: string
  attendee_id: string
  conference_id: string
  // Relationships
  attendees?: Attendee // Singular for backward compatibility
  attendee?: Attendee // Alternative name used in some places
  conferences?: Conference // Singular for backward compatibility
  conference?: Conference // Alternative name used in some places
}

// Attendee entity
export interface Attendee extends BaseEntity {
  first_name: string
  last_name: string
  title?: string
  company?: string
  email?: string
  phone?: string
  notes?: string
  health_system_id?: string
  certifications?: string[]
  // Relationships
  health_systems?: HealthSystem
  attendee_conferences?: AttendeeConference[]
}

// Type alias for all entity types
export type EntityTypes = Attendee | HealthSystem | Conference; 