import { 
  BuildingOfficeIcon, 
  GlobeAltIcon, 
  MapPinIcon,
  UserIcon
} from '@heroicons/react/24/outline'
import { useState, useEffect } from 'react'
import type { HealthSystem, Attendee } from '@/types'
import { EntityDetail, FieldDefinition, TagDefinition, EntityTypes } from '@/components/features/entities/EntityDetail'
import { supabase } from '@/lib/supabase'

interface HealthSystemDetailAdapterProps {
  healthSystem: HealthSystem
  onUpdate?: (updatedHealthSystem: HealthSystem) => void
  onDelete?: (deletedHealthSystemId: string) => void
  onAttendeeClick?: (attendeeId: string) => void
  isNewEntity?: boolean
}

export const HealthSystemDetailAdapter = ({
  healthSystem,
  onUpdate,
  onDelete,
  onAttendeeClick,
  isNewEntity = false
}: HealthSystemDetailAdapterProps) => {
  const [error, setError] = useState<string | null>(null)
  const [fullHealthSystem, setFullHealthSystem] = useState<HealthSystem>(healthSystem)

  // Load full health system data when component mounts
  useEffect(() => {
    const loadHealthSystemData = async () => {
      // Skip for new entities
      if (isNewEntity || !healthSystem.id || healthSystem.id === 'new') {
        return
      }

      try {
        setError(null)
        
        const result = await fetchHealthSystemWithRelationships(healthSystem.id)
        
        if (result.error) {
          console.error('Error loading health system data:', result.error)
          setError('Failed to load complete health system data')
        } else if (result.data) {
          setFullHealthSystem(result.data)
        }
      } catch (err) {
        console.error('Error in loadHealthSystemData:', err)
        setError(err instanceof Error ? err.message : 'Failed to load health system data')
      }
    }

    loadHealthSystemData()
  }, [healthSystem.id, isNewEntity])

  // Define health system fields
  const healthSystemFields: FieldDefinition[] = [
    {
      icon: BuildingOfficeIcon,
      label: 'Definitive ID',
      key: 'definitive_id',
      type: 'text',
      placeholder: 'Definitive ID',
      editable: true
    },
    {
      icon: GlobeAltIcon,
      label: 'Website',
      key: 'website',
      type: 'url',
      placeholder: 'Website',
      editable: true
    },
    {
      icon: MapPinIcon,
      label: 'Address',
      key: 'address',
      type: 'text',
      placeholder: 'Address',
      editable: true
    },
    {
      icon: MapPinIcon,
      label: 'City, State',
      key: 'city.state',
      type: 'text',
      placeholder: 'City, State',
      editable: true
    },
    {
      icon: MapPinIcon,
      label: 'Zip',
      key: 'zip',
      type: 'text',
      placeholder: 'Zip Code',
      editable: true
    }
  ];

  // Function to remove attendee from health system
  const removeAttendee = async (attendee: Attendee) => {
    // Update the attendee to remove the health system link
    const { error } = await supabase
      .from('attendees')
      .update({ health_system_id: null })
      .eq('id', attendee.id);
    
    if (error) throw error;
    
    return;
  };
  
  // Function to add attendee to health system
  const addAttendee = async (entity: EntityTypes, attendee: Attendee) => {
    const healthSystem = entity as HealthSystem;
    
    // Update the attendee to link it to this health system
    const { error } = await supabase
      .from('attendees')
      .update({ health_system_id: healthSystem.id })
      .eq('id', attendee.id);
    
    if (error) throw error;
    
    return;
  };
  
  // Function to get available attendees (ones that aren't already linked to this health system)
  const getAvailableAttendees = async (entity: EntityTypes) => {
    const healthSystem = entity as HealthSystem;
    
    try {
      // Get all attendees that aren't linked to this health system (or any health system)
      const { data, error } = await supabase
        .from('attendees')
        .select(`
          id, 
          first_name, 
          last_name, 
          title, 
          company, 
          email
        `)
        .or(`health_system_id.is.null,health_system_id.neq.${healthSystem.id}`)
        .order('last_name');
      
      if (error) {
        console.error('Error fetching available attendees:', error);
        throw error;
      }
      
      console.log('Available attendees fetched:', data?.length || 0);
      
      return data || [];
    } catch (err) {
      console.error('Error in getAvailableAttendees:', err);
      throw err;
    }
  };

  // Define tags for attendees
  const healthSystemTags: TagDefinition[] = [
    {
      key: 'attendees',
      getItems: (entity) => {
        const healthSystem = entity as HealthSystem;
        return healthSystem.attendees || [];
      },
      getLabel: (item) => {
        return `${item.first_name} ${item.last_name}`;
      },
      getColor: () => 'bg-blue-100 text-blue-800 hover:bg-blue-200',
      icon: UserIcon,
      labelKey: 'Attendees',
      onClick: (item) => {
        console.log('Attendee item clicked:', item);
        // For health systems, the attendee item should already have the ID directly
        if (onAttendeeClick) {
          if (item.id) {
            console.log('Navigating to attendee with ID:', item.id);
            onAttendeeClick(item.id);
          } else {
            console.error('No valid attendee ID found in clicked item:', item);
          }
        }
      },
      // Add tag management capabilities
      removable: true,
      onRemove: removeAttendee,
      addable: true,
      onAdd: addAttendee,
      getAvailableItems: getAvailableAttendees,
      getItemDisplayLabel: (item: { first_name: string; last_name: string; company?: string }) => 
        `${item.first_name} ${item.last_name}${item.company ? ` (${item.company})` : ''}`
    }
  ];

  // Function to fetch health system with all relationships
  const fetchHealthSystemWithRelationships = async (healthSystemId: string) => {
    // If this is a new entity that hasn't been saved yet, return a safe result
    if (isNewEntity || healthSystemId === 'new') {
      return {
        data: healthSystem,
        error: null
      };
    }
    
    try {
      // Fetch health system data
      const healthSystemResponse = await supabase
        .from('health_systems')
        .select('*')
        .eq('id', healthSystemId)
        .single();
      
      if (healthSystemResponse.error) {
        console.error('Error fetching health system data:', healthSystemResponse.error);
        return {
          data: null,
          error: healthSystemResponse.error
        };
      }
      
      // Fetch attendees linked to this health system with complete data
      const attendeesResponse = await supabase
        .from('attendees')
        .select(`
          id, 
          first_name, 
          last_name, 
          title, 
          company, 
          email, 
          phone,
          certifications
        `)
        .eq('health_system_id', healthSystemId)
        .order('last_name');
      
      if (attendeesResponse.error) {
        console.error('Error fetching attendees data:', attendeesResponse.error);
        return {
          data: healthSystemResponse.data,
          error: attendeesResponse.error
        };
      }
      
      console.log('Health system relationships fetched:', {
        healthSystem: healthSystemResponse.data,
        attendees: attendeesResponse.data || []
      });
      
      // Combine the data
      const data = {
        ...healthSystemResponse.data,
        attendees: attendeesResponse.data || []
      };
      
      return {
        data,
        error: null
      };
    } catch (err) {
      console.error('Error in fetchHealthSystemWithRelationships:', err);
      return {
        data: null,
        error: err instanceof Error ? err : new Error('Unknown error fetching health system data')
      };
    }
  };

  // Handle successful update
  const handleUpdate = (updatedHealthSystem: HealthSystem) => {
    setFullHealthSystem(updatedHealthSystem);
    if (onUpdate) {
      onUpdate(updatedHealthSystem);
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
        entity={fullHealthSystem}
        entityType="healthSystem"
        tableName="health_systems"
        iconColor="secondary"
        fields={healthSystemFields}
        tags={healthSystemTags}
        title={(entity) => (entity as HealthSystem).name}
        subtitle={(entity) => `${(entity as HealthSystem).city || ''}, ${(entity as HealthSystem).state || ''}`.replace(', ,', '').replace(/^, /, '').replace(/, $/, '')}
        onUpdate={handleUpdate as (updatedEntity: EntityTypes) => void}
        onDelete={onDelete}
        fetchWithRelationships={fetchHealthSystemWithRelationships}
        isNewEntity={isNewEntity}
      />
    </div>
  );
}; 