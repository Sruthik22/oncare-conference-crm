import { 
  CalendarIcon, 
  MapPinIcon, 
  UserIcon
} from '@heroicons/react/24/outline'
import { useState, useEffect } from 'react'
import type { Conference } from '@/types'
import { EntityDetail, FieldDefinition, TagDefinition, EntityTypes } from '@/components/features/entities/EntityDetail'
import { supabase } from '@/lib/supabase'

interface ConferenceDetailAdapterProps {
  conference: Conference
  onUpdate?: (updatedConference: Conference) => void
  onDelete?: (deletedConferenceId: string) => void
  onAttendeeClick?: (attendeeId: string) => void
  isNewEntity?: boolean
}

export const ConferenceDetailAdapter = ({
  conference,
  onUpdate,
  onDelete,
  onAttendeeClick,
  isNewEntity = false
}: ConferenceDetailAdapterProps) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fullConference, setFullConference] = useState<Conference>(conference)

  // Load full conference data when component mounts
  useEffect(() => {
    const loadConferenceData = async () => {
      // Skip for new entities
      if (isNewEntity || !conference.id || conference.id === 'new') {
        return
      }

      try {
        setLoading(true)
        setError(null)
        
        const result = await fetchConferenceWithRelationships(conference.id)
        
        if (result.error) {
          console.error('Error loading conference data:', result.error)
          setError('Failed to load complete conference data')
        } else if (result.data) {
          setFullConference(result.data)
        }
      } catch (err) {
        console.error('Error in loadConferenceData:', err)
        setError(err instanceof Error ? err.message : 'Failed to load conference data')
      } finally {
        setLoading(false)
      }
    }

    loadConferenceData()
  }, [conference.id, isNewEntity])

  // Define the fields for the conference
  const conferenceFields: FieldDefinition[] = [
    {
      icon: CalendarIcon,
      label: 'Start Date',
      key: 'start_date',
      type: 'date',
      editable: true
    },
    {
      icon: CalendarIcon,
      label: 'End Date',
      key: 'end_date',
      type: 'date',
      editable: true
    },
    {
      icon: MapPinIcon,
      label: 'Location',
      key: 'location',
      type: 'text',
      placeholder: 'Conference Location',
      editable: true
    }
  ];

  // Function to remove attendee from conference
  const removeAttendee = async (attendeeConference: any) => {    
    // Delete the join table entry
    const { error } = await supabase
      .from('attendee_conferences')
      .delete()
      .eq('id', attendeeConference.id);
    
    if (error) throw error;
    
    return;
  };
  
  // Function to add attendee to conference
  const addAttendee = async (entity: EntityTypes, attendee: any) => {
    const conference = entity as Conference;
    
    // Create the attendee-conference relationship
    const attendeeConferenceData = {
      attendee_id: attendee.id,
      conference_id: conference.id
    };
    
    // Add the attendee to the conference by creating a join table entry
    const { error } = await supabase
      .from('attendee_conferences')
      .insert(attendeeConferenceData);
    
    if (error) throw error;
    
    return;
  };
  
  // Function to get available attendees (ones that aren't currently registered for this conference)
  const getAvailableAttendees = async (entity: EntityTypes) => {
    const conference = entity as Conference;
    
    // Get all attendees
    const { data: allAttendees, error: attendeesError } = await supabase
      .from('attendees')
      .select('id, first_name, last_name, title, company')
      .order('last_name');
    
    if (attendeesError) throw attendeesError;
    
    // Get current conference attendees
    const { data: conferenceAttendees, error: caError } = await supabase
      .from('attendee_conferences')
      .select('attendee_id')
      .eq('conference_id', conference.id);
    
    if (caError) throw caError;
    
    // Filter out attendees that are already associated with this conference
    const currentAttendeeIds = conferenceAttendees?.map(ca => ca.attendee_id) || [];
    const availableAttendees = allAttendees?.filter(
      attendee => !currentAttendeeIds.includes(attendee.id)
    ) || [];
    
    return availableAttendees;
  };

  // Define the tags for the conference
  const conferenceTags: TagDefinition[] = [
    {
      key: 'attendees',
      getItems: (entity) => {
        const conference = entity as Conference;
        return conference.attendee_conferences || [];
      },
      getLabel: (item) => {
        // Each item is an AttendeeConference which has an attendee property
        const attendee = item.attendees;
        if (attendee) {
          // Otherwise combine first and last name
          const firstName = attendee.first_name || '';
          const lastName = attendee.last_name || '';
          return `${firstName} ${lastName}`.trim() || 'Unknown Attendee';
        }
        return 'Unknown Attendee';
      },
      getColor: () => 'bg-blue-100 text-blue-800 hover:bg-blue-200',
      icon: UserIcon,
      labelKey: 'Attendees',
      onClick: (item) => {
        // Ensure we have a valid attendee_id and handler before calling
        if (onAttendeeClick && (item.attendee_id || (item.attendees && item.attendees.id))) {
          // Use either the direct attendee_id or get it from the nested attendees object
          const attendeeId = item.attendee_id || (item.attendees ? item.attendees.id : null);
          if (attendeeId) {
            console.log('Navigating to attendee:', attendeeId);
            onAttendeeClick(attendeeId);
          } else {
            console.error('No valid attendee ID found in item:', item);
          }
        }
      },
      // Add tag management capabilities
      removable: true,
      onRemove: removeAttendee,
      addable: true,
      onAdd: addAttendee,
      getAvailableItems: getAvailableAttendees,
      itemLabelKey: 'first_name',
      // Custom label for attendees that combines first and last name
      getItemDisplayLabel: (item: { first_name: string; last_name: string; company?: string }) => 
        `${item.first_name} ${item.last_name}${item.company ? ` (${item.company})` : ''}`
    }
  ];

  // Function to fetch a conference with all its relationships
  const fetchConferenceWithRelationships = async (conferenceId: string) => {
    // If this is a new entity that hasn't been saved yet, return a safe result
    if (isNewEntity || conferenceId === 'new') {
      return {
        data: conference,
        error: null
      };
    }
    
    try {
      // Fetch the conference with attendee relationships
      const response = await supabase
        .from('conferences')
        .select(`
          *,
          attendee_conferences (
            id,
            attendee_id,
            conference_id,
            attendees:attendees (
              id, 
              first_name, 
              last_name, 
              title, 
              company, 
              email
            )
          )
        `)
        .eq('id', conferenceId)
        .single();
      
      console.log('Conference relationships fetched:', response.data);
      
      if (response.error) {
        console.error('Error fetching conference data:', response.error);
        return {
          data: null,
          error: response.error
        };
      }
      
      // Ensure the data structure is consistent by always having attendees property
      if (response.data && response.data.attendee_conferences) {
        // Make sure all attendee_conferences have properly structured attendees data
        response.data.attendee_conferences = response.data.attendee_conferences.map((ac: any) => {
          // Make sure we always have both attendee and attendees references
          return {
            ...ac,
            attendee: ac.attendees // Add attendee reference for backward compatibility
          };
        });
      }
      
      return {
        data: response.data,
        error: null
      };
    } catch (err) {
      console.error('Error in fetchConferenceWithRelationships:', err);
      return {
        data: null,
        error: err instanceof Error ? err : new Error('Unknown error fetching conference data')
      };
    }
  };

  // Handle successful update
  const handleUpdate = (updatedConference: Conference) => {
    setFullConference(updatedConference);
    if (onUpdate) {
      onUpdate(updatedConference);
    }
  };

  return (
    <div>
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      <EntityDetail
        entity={fullConference}
        entityType="conference"
        tableName="conferences"
        iconColor="secondary"
        fields={conferenceFields}
        tags={conferenceTags}
        title={(entity) => (entity as Conference).name}
        onUpdate={handleUpdate as (updatedEntity: EntityTypes) => void}
        onDelete={onDelete}
        fetchWithRelationships={fetchConferenceWithRelationships}
        isNewEntity={isNewEntity}
      />
    </div>
  );
}; 