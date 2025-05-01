export interface Contact {
  id: string
  name: string
  email: string
  phone?: string
  title?: string
  health_system_id: string
  conference_id: string
  created_at: string
  updated_at: string
}

export interface HealthSystem {
  id: string
  name: string
  definitive_id?: string
  website?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  created_at: string
}

export interface Conference {
  id: string
  name: string
  start_date?: string
  end_date?: string
  location?: string
  created_at: string
}

export interface AttendeeConference {
  id: string
  attendee_id: string
  conference_id: string
  created_at: string
  conferences?: Conference
}

export interface Attendee {
  id: string
  first_name: string
  last_name: string
  certifications: string[]
  title?: string
  company?: string
  health_system_id?: string
  health_systems?: HealthSystem
  email?: string
  phone?: string
  linkedin_url?: string
  notes?: string
  created_at: string
  updated_at: string
  attendee_conferences?: AttendeeConference[]
} 