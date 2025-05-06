import { 
  UserIcon, 
  BuildingOfficeIcon, 
  EnvelopeIcon,
  PhoneIcon,
  LinkIcon,
  DocumentTextIcon,
  AcademicCapIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline'
import type { Attendee, HealthSystem } from '@/types'
import { EntityDetail, FieldDefinition, TagDefinition, EntityTypes } from './EntityDetail'
import { supabase } from '@/lib/supabase'

interface AttendeeConference {
  id: string;
  conference_id: string;
  conferences?: {
    name: string;
  };
}

interface AttendeeDetailAdapterProps {
  attendee: Attendee
  conferenceName?: string
  onUpdate?: (updatedAttendee: Attendee) => void
  onDelete?: (deletedAttendeeId: string) => void
  onHealthSystemClick?: (healthSystemId: string) => void
  onConferenceClick?: (conferenceId: string) => void
  isNewEntity?: boolean
}

export const AttendeeDetailAdapter = ({
  attendee,
  conferenceName,
  onUpdate,
  onDelete,
  onHealthSystemClick,
  onConferenceClick,
  isNewEntity = false
}: AttendeeDetailAdapterProps) => {
  // Define the fields for the attendee
  const attendeeFields: FieldDefinition[] = [
    {
      icon: UserIcon,
      label: 'Title',
      key: 'title',
      type: 'text',
      placeholder: 'Job Title',
      editable: true
    },
    {
      icon: BuildingOfficeIcon,
      label: 'Company',
      key: 'company',
      type: 'text',
      placeholder: 'Company or Organization',
      editable: true
    },
    {
      icon: EnvelopeIcon,
      label: 'Email',
      key: 'email',
      type: 'email',
      placeholder: 'Email Address',
      editable: true,
      linkable: true
    },
    {
      icon: PhoneIcon,
      label: 'Phone',
      key: 'phone',
      type: 'phone',
      placeholder: 'Phone Number',
      editable: true,
      linkable: true
    },
    {
      icon: LinkIcon,
      label: 'LinkedIn',
      key: 'linkedin_url',
      type: 'url',
      placeholder: 'LinkedIn URL',
      editable: true,
      linkable: true
    },
    {
      icon: DocumentTextIcon,
      label: 'Notes',
      key: 'notes',
      type: 'textarea',
      placeholder: 'Add notes about this attendee',
      editable: true
    }
  ];

  // Function to remove health system from attendee
  const removeHealthSystem = async (entity: EntityTypes) => {
    const attendee = entity as Attendee;
    // Just set health_system_id to null
    const { error } = await supabase
      .from('attendees')
      .update({ health_system_id: null })
      .eq('id', attendee.id);
    
    if (error) throw error;
    
    return;
  };
  
  // Function to add health system to attendee
  const addHealthSystem = async (entity: EntityTypes, healthSystem: any) => {
    const attendee = entity as Attendee;
    
    // Add the health system to the attendee by updating the health_system_id field
    const { error } = await supabase
      .from('attendees')
      .update({ health_system_id: healthSystem.id })
      .eq('id', attendee.id);
    
    if (error) throw error;
    
    return;
  };
  
  // Function to get available health systems (ones that aren't currently assigned)
  const getAvailableHealthSystems = async () => {
    const { data, error } = await supabase
      .from('health_systems')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return data || [];
  };
  
  // Function to remove conference from attendee
  const removeConference = async (conference: any) => {
    // Delete the join table entry
    const { error } = await supabase
      .from('attendee_conferences')
      .delete()
      .eq('id', conference.id);
    
    if (error) throw error;
    
    return;
  };
  
  // Function to add conference to attendee
  const addConference = async (entity: EntityTypes, conference: any) => {
    const attendee = entity as Attendee;
    
    // Create the attendee-conference relationship
    const attendeeConferenceData = {
      attendee_id: attendee.id,
      conference_id: conference.id
    };
    
    // Add the conference to the attendee by creating a join table entry
    const { error } = await supabase
      .from('attendee_conferences')
      .insert(attendeeConferenceData);
    
    if (error) throw error;
    
    return;
  };
  
  // Function to get available conferences (ones that aren't currently assigned)
  const getAvailableConferences = async (entity: EntityTypes) => {
    const attendee = entity as Attendee;
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
      .eq('attendee_id', attendee.id);
    
    if (acError) throw acError;
    
    // Filter out conferences that are already associated with this attendee
    const currentConferenceIds = attendeeConferences?.map(ac => ac.conference_id) || [];
    const availableConferences = allConferences?.filter(
      conference => !currentConferenceIds.includes(conference.id)
    ) || [];
    
    return availableConferences;
  };

  // Function to fetch an attendee with all its relationships
  const fetchAttendeeWithRelationships = async (attendeeId: string) => {
    // If this is a new entity that hasn't been saved yet, return a safe result
    if (isNewEntity || attendeeId === 'new') {
      return {
        data: attendee,
        error: null
      };
    }
    
    // Fetch the attendee with health system and conference relationships
    const response = await supabase
      .from('attendees')
      .select('*, health_systems(*), attendee_conferences(*, conferences(*))')
      .eq('id', attendeeId)
      .single();
      
    return {
      data: response.data,
      error: response.error
    };
  };

  // Define tags for linked entities
  const attendeeTags: TagDefinition[] = [
    // Health System tag
    {
      key: 'health_system',
      getItems: (entity: EntityTypes) => {
        const attendee = entity as Attendee;
        return attendee.health_systems ? [attendee.health_systems] : [];
      },
      getLabel: (item: HealthSystem) => item.name || 'Unknown Health System',
      getColor: () => 'bg-blue-100 text-blue-800 hover:bg-blue-200',
      icon: BuildingOfficeIcon,
      onClick: () => {
        if (onHealthSystemClick && attendee.health_system_id) {
          onHealthSystemClick(attendee.health_system_id);
        }
      },
      labelKey: 'Health System',
      // Add tag management capabilities
      removable: true,
      onRemove: removeHealthSystem,
      addable: true,
      onAdd: (entity, item) => addHealthSystem(entity, item),
      getAvailableItems: getAvailableHealthSystems,
      itemLabelKey: 'name'
    },
    // Conferences tags
    {
      key: 'conferences',
      getItems: (entity: EntityTypes) => {
        const attendee = entity as Attendee;
        return attendee.attendee_conferences || [];
      },
      getLabel: (item: AttendeeConference) => item.conferences?.name || conferenceName || 'Unknown Conference',
      getColor: (idx: number) => {
        const colors = [
          'bg-green-100 text-green-800 hover:bg-green-200',
          'bg-purple-100 text-purple-800 hover:bg-purple-200',
          'bg-amber-100 text-amber-800 hover:bg-amber-200',
        ];
        return colors[idx % colors.length];
      },
      icon: CalendarIcon,
      onClick: (item: AttendeeConference) => {
        if (onConferenceClick) {
          onConferenceClick(item.conference_id);
        }
      },
      labelKey: 'Conferences',
      // Add tag management capabilities
      removable: true,
      onRemove: removeConference,
      addable: true,
      onAdd: (entity, item) => addConference(entity, item),
      getAvailableItems: getAvailableConferences,
      itemLabelKey: 'name'
    },
    {
      key: 'certifications',
      getItems: (entity: EntityTypes) => {
        const attendee = entity as Attendee;
        return attendee.certifications ? attendee.certifications.map(cert => ({ name: cert })) : [];
      },
      getLabel: (item: { name: string }) => item.name,
      getColor: (idx: number) => {
        const colors = [
          'bg-indigo-100 text-indigo-800 hover:bg-indigo-200',
          'bg-emerald-100 text-emerald-800 hover:bg-emerald-200',
          'bg-cyan-100 text-cyan-800 hover:bg-cyan-200',
        ];
        return colors[idx % colors.length];
      },
      icon: AcademicCapIcon,
      labelKey: 'Certifications',
      itemLabelKey: 'name'
    }
  ];

  return (
    <EntityDetail
      entity={attendee}
      entityType="attendee"
      tableName="attendees"
      iconColor="primary"
      fields={attendeeFields}
      tags={attendeeTags}
      title={(entity) => `${(entity as Attendee).first_name} ${(entity as Attendee).last_name}`}
      subtitle={(entity) => (entity as Attendee).title || null}
      onUpdate={onUpdate as (updatedEntity: any) => void}
      onDelete={onDelete}
      showApolloIntegration={true}
      conferenceName={conferenceName}
      fetchWithRelationships={fetchAttendeeWithRelationships}
      isNewEntity={isNewEntity}
    />
  );
}; 