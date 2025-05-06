import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { Attendee, HealthSystem, Conference } from '@/types';

/**
 * Interface for data store result
 */
interface DataStoreResult {
  // Data
  attendees: Attendee[];
  healthSystems: HealthSystem[];
  conferences: Conference[];
  
  // Status
  isLoading: boolean;
  error: string | null;
  
  // Update functions
  updateAttendee: (attendee: Partial<Attendee> & { id: string }) => Promise<boolean>;
  updateHealthSystem: (healthSystem: Partial<HealthSystem> & { id: string }) => Promise<boolean>;
  updateConference: (conference: Partial<Conference> & { id: string }) => Promise<boolean>;
  
  // Delete functions
  deleteAttendee: (id: string) => Promise<boolean>;
  deleteHealthSystem: (id: string) => Promise<boolean>;
  deleteConference: (id: string) => Promise<boolean>;
  
  // Refresh functions
  refetchAttendees: () => Promise<void>;
  refetchHealthSystems: () => Promise<void>;
  refetchConferences: () => Promise<void>;
  refetchAll: () => Promise<void>;
}

/**
 * Helper function to fetch all records with pagination
 */
async function fetchAllRecords<T>(
  table: string, 
  select: string = '*', 
  pageSize: number = 100 // Reduce page size to avoid resource issues
): Promise<T[]> {
  let allRecords: T[] = [];
  let page = 0;
  let hasMore = true;
  let retryCount = 0;
  const maxRetries = 3;

  while (hasMore) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select(select)
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) throw error;

      allRecords = [...allRecords, ...(data as T[])];
      hasMore = data.length === pageSize;
      page++;
      
      // Add a small delay between requests to avoid overwhelming resources
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (err) {
      console.error(`Error fetching ${table} records (page ${page}):`, err);
      
      // Implement retry logic
      retryCount++;
      if (retryCount > maxRetries) {
        console.error(`Max retries reached for ${table}, returning partial results`);
        hasMore = false; // Exit the loop
      } else {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log(`Retrying ${table} fetch (attempt ${retryCount})`);
      }
    }
  }

  return allRecords;
}

/**
 * A central data store hook to manage data fetching and state
 */
export function useDataStore(): DataStoreResult {
  // State
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [healthSystems, setHealthSystems] = useState<HealthSystem[]>([]);
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Get authentication status
  const { session } = useAuth();

  /**
   * Fetch attendees with related data
   */
  const fetchAttendees = useCallback(async () => {
    if (!session) return;
    
    try {
      const query = `
        *,
        health_systems (*),
        attendee_conferences (
          id,
          conference_id,
          conferences (
            id,
            name,
            start_date,
            end_date,
            location
          )
        )
      `;
      
      const data = await fetchAllRecords<Attendee>('attendees', query);
      
      // Log some sample data to debug relationships
      if (data.length > 0) {
        const sampleAttendee = data[0];
        console.log('Sample attendee with relationships:', {
          name: `${sampleAttendee.first_name} ${sampleAttendee.last_name}`,
          health_system: sampleAttendee.health_systems?.name,
          attendee_conferences: sampleAttendee.attendee_conferences,
          has_conferences: sampleAttendee.attendee_conferences && sampleAttendee.attendee_conferences.length > 0,
          first_conference: sampleAttendee.attendee_conferences?.[0]?.conferences
        });
      }
      
      setAttendees(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch attendees';
      console.error(errorMessage, err);
      setError(errorMessage);
    }
  }, [session]);

  /**
   * Fetch health systems
   */
  const fetchHealthSystems = useCallback(async () => {
    if (!session) return;
    
    try {
      // Use explicit relationship selection with pagination
      const query = `
        *,
        attendees:attendees(
          id,
          first_name,
          last_name,
          title,
          company
        )
      `;
      
      const data = await fetchAllRecords<HealthSystem>('health_systems', query);
      
      // Log sample data for debugging
      if (data.length > 0) {
        const sampleHealthSystem = data[0];
        console.log('Sample health system with relationships:', {
          name: sampleHealthSystem.name,
          attendees: sampleHealthSystem.attendees,
          has_attendees: sampleHealthSystem.attendees && sampleHealthSystem.attendees.length > 0
        });
      }
      
      setHealthSystems(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch health systems';
      console.error(errorMessage, err);
      setError(errorMessage);
      
      // If fetching with relationships fails, try without them as fallback
      try {
        console.log('Trying fallback fetch for health systems without relationships');
        const { data } = await supabase.from('health_systems').select('*');
        setHealthSystems(data || []);
      } catch (fallbackErr) {
        console.error('Fallback fetch also failed:', fallbackErr);
      }
    }
  }, [session]);

  /**
   * Fetch conferences with related data
   */
  const fetchConferences = useCallback(async () => {
    if (!session) return;
    
    try {
      const query = `
        *,
        attendee_conferences (
          id,
          attendee_id,
          attendees (
            id,
            first_name,
            last_name,
            title,
            company
          )
        )
      `;
      
      const data = await fetchAllRecords<Conference>('conferences', query);
      
      // Log sample data for debugging
      if (data.length > 0) {
        const sampleConference = data[0];
        console.log('Sample conference with relationships:', {
          name: sampleConference.name,
          attendee_conferences: sampleConference.attendee_conferences,
          hasAttendeeConferences: sampleConference.attendee_conferences && sampleConference.attendee_conferences.length > 0,
          firstAttendee: sampleConference.attendee_conferences?.[0]?.attendee
        });
      }
      
      setConferences(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch conferences';
      console.error(errorMessage, err);
      setError(errorMessage);
      
      // If fetching with relationships fails, try without them as fallback
      try {
        console.log('Trying fallback fetch for conferences without relationships');
        const { data } = await supabase.from('conferences').select('*');
        setConferences(data || []);
      } catch (fallbackErr) {
        console.error('Fallback fetch also failed:', fallbackErr);
      }
    }
  }, [session]);

  /**
   * Fetch all data
   */
  const fetchAllData = useCallback(async () => {
    if (!session) {
      setAttendees([]);
      setHealthSystems([]);
      setConferences([]);
      setError("Authentication required to access data");
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      await Promise.all([
        fetchAttendees(),
        fetchHealthSystems(),
        fetchConferences()
      ]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
      console.error(errorMessage, err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [session, fetchAttendees, fetchHealthSystems, fetchConferences]);

  /**
   * Update an attendee
   */
  const updateAttendee = async (attendee: Partial<Attendee> & { id: string }): Promise<boolean> => {
    try {
      const { id, ...updateData } = attendee;
      
      const { error } = await supabase
        .from('attendees')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
      
      // Update local state
      setAttendees(prevAttendees => 
        prevAttendees.map(a => a.id === id ? { ...a, ...attendee } : a)
      );
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update attendee';
      console.error(errorMessage, err);
      setError(errorMessage);
      return false;
    }
  };

  /**
   * Update a health system
   */
  const updateHealthSystem = async (healthSystem: Partial<HealthSystem> & { id: string }): Promise<boolean> => {
    try {
      const { id, ...updateData } = healthSystem;
      
      const { error } = await supabase
        .from('health_systems')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
      
      // Update local state
      setHealthSystems(prevHealthSystems => 
        prevHealthSystems.map(hs => hs.id === id ? { ...hs, ...healthSystem } : hs)
      );
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update health system';
      console.error(errorMessage, err);
      setError(errorMessage);
      return false;
    }
  };

  /**
   * Update a conference
   */
  const updateConference = async (conference: Partial<Conference> & { id: string }): Promise<boolean> => {
    try {
      const { id, ...updateData } = conference;
      
      const { error } = await supabase
        .from('conferences')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
      
      // Update local state
      setConferences(prevConferences => 
        prevConferences.map(c => c.id === id ? { ...c, ...conference } : c)
      );
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update conference';
      console.error(errorMessage, err);
      setError(errorMessage);
      return false;
    }
  };

  /**
   * Delete an attendee
   */
  const deleteAttendee = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('attendees')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      // Update local state
      setAttendees(prevAttendees => prevAttendees.filter(a => a.id !== id));
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete attendee';
      console.error(errorMessage, err);
      setError(errorMessage);
      return false;
    }
  };

  /**
   * Delete a health system
   */
  const deleteHealthSystem = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('health_systems')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      // Update local state
      setHealthSystems(prevHealthSystems => prevHealthSystems.filter(hs => hs.id !== id));
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete health system';
      console.error(errorMessage, err);
      setError(errorMessage);
      return false;
    }
  };

  /**
   * Delete a conference
   */
  const deleteConference = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('conferences')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      // Update local state
      setConferences(prevConferences => prevConferences.filter(c => c.id !== id));
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete conference';
      console.error(errorMessage, err);
      setError(errorMessage);
      return false;
    }
  };

  // Fetch data on mount and when session changes
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  return {
    // Data
    attendees,
    healthSystems,
    conferences,
    
    // Status
    isLoading,
    error,
    
    // Update functions
    updateAttendee,
    updateHealthSystem,
    updateConference,
    
    // Delete functions
    deleteAttendee,
    deleteHealthSystem,
    deleteConference,
    
    // Refresh functions
    refetchAttendees: fetchAttendees,
    refetchHealthSystems: fetchHealthSystems,
    refetchConferences: fetchConferences,
    refetchAll: fetchAllData,
  };
} 