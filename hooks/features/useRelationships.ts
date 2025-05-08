import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Attendee, HealthSystem, Conference } from '@/types';

/**
 * Type definitions for relationship operations
 */

interface RelationshipHook {
  // Link operations
  linkAttendeeToHealthSystem: (attendeeId: string, healthSystemId: string) => Promise<boolean>;
  unlinkAttendeeFromHealthSystem: (attendeeId: string) => Promise<boolean>;
  linkAttendeeToConference: (attendeeId: string, conferenceId: string) => Promise<boolean>;
  unlinkAttendeeFromConference: (attendeeId: string, conferenceId: string) => Promise<boolean>;
  
  // Fetch related entities
  getAttendeesByHealthSystem: (healthSystemId: string) => Promise<Attendee[]>;
  getAttendeesByConference: (conferenceId: string) => Promise<Attendee[]>;
  getConferencesByAttendee: (attendeeId: string) => Promise<Conference[]>;
  
  // Fetch available entities for linking
  getAvailableHealthSystems: (currentHealthSystemId?: string) => Promise<HealthSystem[]>;
  getAvailableConferences: (attendeeId: string) => Promise<Conference[]>;
  
  // Status
  isLoading: boolean;
  error: string | null;
}

/**
 * A hook to manage relationships between entities
 */
export function useRelationships(): RelationshipHook {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Link an attendee to a health system
   */
  const linkAttendeeToHealthSystem = async (attendeeId: string, healthSystemId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase
        .from('attendees')
        .update({ health_system_id: healthSystemId })
        .eq('id', attendeeId);
      
      if (error) throw error;
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to link attendee to health system';
      setError(errorMessage);
      console.error(errorMessage, err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Unlink an attendee from a health system
   */
  const unlinkAttendeeFromHealthSystem = async (attendeeId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase
        .from('attendees')
        .update({ health_system_id: null })
        .eq('id', attendeeId);
      
      if (error) throw error;
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to unlink attendee from health system';
      setError(errorMessage);
      console.error(errorMessage, err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Link an attendee to a conference (many-to-many)
   */
  const linkAttendeeToConference = async (attendeeId: string, conferenceId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Check if relationship already exists
      const { data: existingLink, error: checkError } = await supabase
        .from('attendee_conferences')
        .select('id')
        .eq('attendee_id', attendeeId)
        .eq('conference_id', conferenceId)
        .maybeSingle();
      
      if (checkError) throw checkError;
      
      // If relationship already exists, return success
      if (existingLink) return true;
      
      // Create new relationship
      const { error } = await supabase
        .from('attendee_conferences')
        .insert({
          attendee_id: attendeeId,
          conference_id: conferenceId
        });
      
      if (error) throw error;
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to link attendee to conference';
      setError(errorMessage);
      console.error(errorMessage, err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Unlink an attendee from a conference
   */
  const unlinkAttendeeFromConference = async (attendeeId: string, conferenceId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase
        .from('attendee_conferences')
        .delete()
        .match({
          attendee_id: attendeeId,
          conference_id: conferenceId
        });
      
      if (error) throw error;
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to unlink attendee from conference';
      setError(errorMessage);
      console.error(errorMessage, err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Get all attendees associated with a health system
   */
  const getAttendeesByHealthSystem = async (healthSystemId: string): Promise<Attendee[]> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('attendees')
        .select('*')
        .eq('health_system_id', healthSystemId);
      
      if (error) throw error;
      
      return data || [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get attendees by health system';
      setError(errorMessage);
      console.error(errorMessage, err);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Get all attendees associated with a conference
   */
  const getAttendeesByConference = async (conferenceId: string): Promise<Attendee[]> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('attendee_conferences')
        .select(`
          attendee_id,
          attendees:attendee_id (*)
        `)
        .eq('conference_id', conferenceId);
      
      if (error) throw error;
      
      // Extract attendees from junction table results
      return (data || [])
        .map(item => item.attendees as unknown as Attendee)
        .filter(Boolean);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get attendees by conference';
      setError(errorMessage);
      console.error(errorMessage, err);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Get all conferences associated with an attendee
   */
  const getConferencesByAttendee = async (attendeeId: string): Promise<Conference[]> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('attendee_conferences')
        .select(`
          conference_id,
          conferences:conference_id (*)
        `)
        .eq('attendee_id', attendeeId);
      
      if (error) throw error;
      
      // Extract conferences from junction table results
      return (data || [])
        .map(item => item.conferences as unknown as Conference)
        .filter(Boolean);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get conferences by attendee';
      setError(errorMessage);
      console.error(errorMessage, err);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Get all available health systems for linking
   */
  const getAvailableHealthSystems = async (): Promise<HealthSystem[]> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('health_systems')
        .select('*')
        .order('name');
      
      if (error) throw error;
      
      return data || [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get available health systems';
      setError(errorMessage);
      console.error(errorMessage, err);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Get all available conferences for linking to an attendee
   */
  const getAvailableConferences = async (attendeeId: string): Promise<Conference[]> => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Get all conferences
      const { data: allConferences, error: conferencesError } = await supabase
        .from('conferences')
        .select('*')
        .order('name');
      
      if (conferencesError) throw conferencesError;
      
      // Get current attendee conferences
      const { data: attendeeConferences, error: acError } = await supabase
        .from('attendee_conferences')
        .select('conference_id')
        .eq('attendee_id', attendeeId);
      
      if (acError) throw acError;
      
      // Convert to array of conference IDs
      const currentConferenceIds = new Set(
        (attendeeConferences || []).map(ac => ac.conference_id)
      );
      
      // Filter to only include conferences not already linked
      return (allConferences || []).filter(
        conference => !currentConferenceIds.has(conference.id)
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get available conferences';
      setError(errorMessage);
      console.error(errorMessage, err);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  return {
    linkAttendeeToHealthSystem,
    unlinkAttendeeFromHealthSystem,
    linkAttendeeToConference,
    unlinkAttendeeFromConference,
    getAttendeesByHealthSystem,
    getAttendeesByConference,
    getConferencesByAttendee,
    getAvailableHealthSystems,
    getAvailableConferences,
    isLoading,
    error
  };
} 