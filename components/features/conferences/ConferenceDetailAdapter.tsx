import { 
  CalendarIcon, 
  MapPinIcon, 
  UserIcon
} from '@heroicons/react/24/outline'
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
        const attendee = item.attendee;
        if (attendee) {
          return `${attendee.first_name} ${attendee.last_name}`;
        }
        return 'Unknown Attendee';
      },
      getColor: () => 'bg-blue-100 text-blue-800 hover:bg-blue-200',
      icon: UserIcon,
      labelKey: 'Attendees',
      onClick: (item) => {
        if (onAttendeeClick && item.attendee_id) {
          onAttendeeClick(item.attendee_id);
        }
      },
      // Add tag management capabilities
      removable: true,
      onRemove: removeAttendee,
      addable: true,
      onAdd: (entity, item) => addAttendee(entity, item),
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
    
    // Fetch the conference with attendee relationships
    const response = await supabase
      .from('conferences')
      .select('*, attendee_conferences(id, attendee_id, conference_id, attendees:attendees(id, first_name, last_name, title, company))')
      .eq('id', conferenceId)
      .single();
    
    console.log('Conference relationships fetched:', response.data);
    
    // Fix the data structure to match what the component expects
    if (response.data && response.data.attendee_conferences) {
      // Map attendees to attendee property for compatibility
      response.data.attendee_conferences = response.data.attendee_conferences.map((ac: any) => ({
        ...ac,
        attendee: ac.attendees
      }));
    }
      
    return {
      data: response.data,
      error: response.error
    };
  };

  return (
    <EntityDetail
      entity={conference}
      entityType="conference"
      tableName="conferences"
      iconColor="secondary"
      fields={conferenceFields}
      tags={conferenceTags}
      title={(entity) => (entity as Conference).name}
      onUpdate={onUpdate as (updatedEntity: any) => void}
      onDelete={onDelete}
      fetchWithRelationships={fetchConferenceWithRelationships}
      isNewEntity={isNewEntity}
    />
  );
}; 