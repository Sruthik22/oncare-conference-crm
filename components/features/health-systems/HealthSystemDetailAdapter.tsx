import { 
  BuildingOfficeIcon, 
  MapPinIcon, 
  LinkIcon,
  IdentificationIcon,
  UserIcon
} from '@heroicons/react/24/outline'
import type { HealthSystem } from '@/types'
import { EntityDetail, FieldDefinition, TagDefinition, EntityTypes } from '@/components/features/entities/EntityDetail'
import { supabase } from '@/lib/supabase'

interface HealthSystemDetailAdapterProps {
  healthSystem: HealthSystem
  onUpdate?: (updatedHealthSystem: HealthSystem) => void
  onDelete?: (deletedHealthSystemId: string) => void
  onAttendeeClick?: (attendeeId: string) => void
  linkedAttendees?: Array<{id: string, first_name: string, last_name: string}>
  isNewEntity?: boolean
}

export const HealthSystemDetailAdapter = ({
  healthSystem,
  onUpdate,
  onDelete,
  onAttendeeClick,
  linkedAttendees = [],
  isNewEntity = false
}: HealthSystemDetailAdapterProps) => {
  // Define the fields for the health system
  const healthSystemFields: FieldDefinition[] = [
    {
      icon: IdentificationIcon,
      label: 'Definitive ID',
      key: 'definitive_id',
      type: 'text',
      placeholder: 'Definitive ID',
      editable: true
    },
    {
      icon: BuildingOfficeIcon,
      label: 'Address',
      key: 'address',
      type: 'text',
      placeholder: 'Street Address',
      editable: true,
    },
    {
      icon: MapPinIcon,
      label: 'City / State',
      key: 'city.state',
      type: 'text',
      placeholder: 'City, State',
      editable: true,
    },
    {
      icon: MapPinIcon,
      label: 'ZIP Code',
      key: 'zip',
      type: 'text',
      placeholder: 'ZIP Code',
      editable: true,
    },
    {
      icon: LinkIcon,
      label: 'Website',
      key: 'website',
      type: 'url',
      placeholder: 'Website URL',
      editable: true,
      linkable: true
    }
  ];

  // Function to remove attendee from health system
  const removeAttendee = async (attendee: any) => {    
    // Update the attendee to remove the health system link
    const { error } = await supabase
      .from('attendees')
      .update({ health_system_id: null })
      .eq('id', attendee.id);
    
    if (error) throw error;
    
    return;
  };
  
  // Function to add attendee to health system
  const addAttendee = async (entity: EntityTypes, attendee: any) => {
    const healthSystem = entity as HealthSystem;
    
    // Update the attendee to link it to this health system
    const { error } = await supabase
      .from('attendees')
      .update({ health_system_id: healthSystem.id })
      .eq('id', attendee.id);
    
    if (error) throw error;
    
    return;
  };
  
  // Function to get available attendees (ones that aren't currently linked to this health system)
  const getAvailableAttendees = async (entity: EntityTypes) => {
    const healthSystem = entity as HealthSystem;
    
    // Get all attendees that are not linked to this health system or any health system
    const { data, error } = await supabase
      .from('attendees')
      .select('id, first_name, last_name, title, company')
      .or(`health_system_id.is.null,health_system_id.neq.${healthSystem.id}`)
      .order('last_name');
    
    if (error) throw error;
    return data || [];
  };

  // Define the tags for linked entities
  const healthSystemTags: TagDefinition[] = [
    {
      key: 'attendees',
      getItems: () => {
        // Use the pre-fetched attendees or fetch them when needed
        return linkedAttendees || [];
      },
      getLabel: (item) => `${item.first_name} ${item.last_name}`,
      getColor: () => 'bg-blue-100 text-blue-800 hover:bg-blue-200',
      icon: UserIcon,
      onClick: (item) => {
        if (onAttendeeClick) {
          onAttendeeClick(item.id);
        }
      },
      labelKey: 'Attendees',
      // Add tag management capabilities
      removable: true,
      onRemove: removeAttendee,
      addable: true,
      onAdd: (entity, item) => addAttendee(entity, item),
      getAvailableItems: getAvailableAttendees,
      getItemDisplayLabel: (item: { first_name: string; last_name: string; company?: string }) => 
        `${item.first_name} ${item.last_name}${item.company ? ` (${item.company})` : ''}`
    }
  ];

  // Function to fetch a health system with all its relationships
  const fetchHealthSystemWithRelationships = async (healthSystemId: string) => {
    // If this is a new entity that hasn't been saved yet, return a safe result
    if (isNewEntity || healthSystemId === 'new') {
      return {
        data: healthSystem,
        error: null
      };
    }
    
    // Fetch the health system
    const response = await supabase
      .from('health_systems')
      .select('*')
      .eq('id', healthSystemId)
      .single();
    
    if (response.error) {
      return {
        data: null,
        error: response.error
      };
    }
    
    // Combine with provided linked attendees if any
    if (linkedAttendees && linkedAttendees.length > 0) {
      response.data.attendees = linkedAttendees;
    } else {
      // Fetch attendees linked to this health system
      const attendeesResponse = await supabase
        .from('attendees')
        .select('id, first_name, last_name, title, company')
        .eq('health_system_id', healthSystemId);
      
      if (!attendeesResponse.error) {
        response.data.attendees = attendeesResponse.data || [];
      }
    }
    
    return {
      data: response.data,
      error: null
    };
  };

  return (
    <EntityDetail
      entity={healthSystem}
      entityType="healthSystem"
      tableName="health_systems"
      iconColor="accent"
      fields={healthSystemFields}
      tags={healthSystemTags}
      title={(entity) => (entity as HealthSystem).name}
      subtitle={(entity) => `${(entity as HealthSystem).city || ''}, ${(entity as HealthSystem).state || ''}`}
      onUpdate={onUpdate as (updatedEntity: any) => void}
      onDelete={onDelete}
      fetchWithRelationships={fetchHealthSystemWithRelationships}
      isNewEntity={isNewEntity}
    />
  );
}; 