import React, { useState, useEffect } from 'react';
import { useRelationships } from '@/hooks/useRelationships';
import { BuildingOfficeIcon, CalendarIcon, UserIcon, PlusCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
/**
 * Types of relations supported
 */
type RelationType = 'health_system' | 'conference' | 'attendee';

interface RelationOption {
  id: string;
  name: string;
}

interface RelationFieldProps {
  /** ID of the current entity */
  entityId: string;
  /** Type of the current entity */
  entityType: 'attendee' | 'health_system' | 'conference';
  /** Type of relation to display */
  relationType: RelationType;
  /** Currently linked entity (for single relations) */
  current?: { id: string; name: string } | null;
  /** Currently linked entities (for multi relations) */
  currentItems?: Array<{ id: string; name: string }>;
  /** Whether the field is editable */
  editable?: boolean;
  /** Callback when a relation is changed */
  onChange?: () => void;
  /** Click handler for relation items */
  onItemClick?: (id: string, type: RelationType) => void;
  /** Label for the field */
  label?: string;
  /** Placeholder text for empty state */
  placeholder?: string;
}

/**
 * A component for displaying and editing relations between entities
 */
export function RelationField({
  entityId,
  entityType,
  relationType,
  current,
  currentItems = [],
  editable = false,
  onChange,
  onItemClick,
  label,
  placeholder = 'None'
}: RelationFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [availableOptions, setAvailableOptions] = useState<RelationOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Get relationship hook methods
  const relationships = useRelationships();
  
  // Determine if this is a multi-relation field
  const isMultiRelation = 
    (entityType === 'health_system' && relationType === 'attendee') ||
    (entityType === 'conference' && relationType === 'attendee') ||
    (entityType === 'attendee' && relationType === 'conference');
  
  // Get the appropriate icon for the relation type
  const getRelationIcon = () => {
    switch (relationType) {
      case 'health_system':
        return <BuildingOfficeIcon className="h-4 w-4 text-indigo-500" />;
      case 'conference':
        return <CalendarIcon className="h-4 w-4 text-indigo-500" />;
      case 'attendee':
        return <UserIcon className="h-4 w-4 text-indigo-500" />;
    }
  };
  
  // Load available options when entering edit mode
  useEffect(() => {
    if (!isEditing) return;
    
    const loadOptions = async () => {
      setIsLoading(true);
      try {
        if (entityType === 'attendee' && relationType === 'health_system') {
          // Get available health systems for an attendee
          const options = await relationships.getAvailableHealthSystems(current?.id);
          setAvailableOptions(options.map(hs => ({ id: hs.id, name: hs.name })));
        } 
        else if (entityType === 'attendee' && relationType === 'conference') {
          // Get available conferences for an attendee
          const options = await relationships.getAvailableConferences(entityId);
          setAvailableOptions(options.map(conf => ({ id: conf.id, name: conf.name })));
        }
      } catch (error) {
        console.error('Error loading relation options:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadOptions();
  }, [isEditing, entityType, relationType, entityId, current?.id, relationships]);
  
  // Handle linking an entity
  const handleLink = async (optionId: string) => {
    setIsLoading(true);
    
    try {
      let success = false;
      
      if (entityType === 'attendee' && relationType === 'health_system') {
        // Link attendee to health system
        success = await relationships.linkAttendeeToHealthSystem(entityId, optionId);
      } 
      else if (entityType === 'attendee' && relationType === 'conference') {
        // Link attendee to conference
        success = await relationships.linkAttendeeToConference(entityId, optionId);
      }
      
      if (success && onChange) {
        onChange();
      }
    } catch (error) {
      console.error('Error linking entities:', error);
    } finally {
      setIsLoading(false);
      setIsEditing(false);
    }
  };
  
  // Handle unlinking an entity
  const handleUnlink = async (optionId: string) => {
    setIsLoading(true);
    
    try {
      let success = false;
      
      if (entityType === 'attendee' && relationType === 'health_system') {
        // Unlink attendee from health system
        success = await relationships.unlinkAttendeeFromHealthSystem(entityId);
      } 
      else if (entityType === 'attendee' && relationType === 'conference') {
        // Unlink attendee from conference
        success = await relationships.unlinkAttendeeFromConference(entityId, optionId);
      }
      
      if (success && onChange) {
        onChange();
      }
    } catch (error) {
      console.error('Error unlinking entities:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Render for multi-relation field
  if (isMultiRelation) {
    return (
      <div className="space-y-2">
        {label && <div className="text-sm font-medium text-gray-700">{label}</div>}
        
        <div className="space-y-1">
          {currentItems.length === 0 ? (
            <div className="text-sm text-gray-400">{placeholder}</div>
          ) : (
            currentItems.map(item => (
              <div key={item.id} className="flex items-center justify-between">
                <div 
                  className="flex items-center space-x-2 text-sm text-gray-900 cursor-pointer hover:text-indigo-600"
                  onClick={() => onItemClick?.(item.id, relationType)}
                >
                  {getRelationIcon()}
                  <span>{item.name}</span>
                </div>
                
                {editable && (
                  <button
                    type="button"
                    onClick={() => handleUnlink(item.id)}
                    className="text-gray-400 hover:text-red-500"
                    disabled={isLoading}
                  >
                    <XCircleIcon className="h-5 w-5" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
        
        {editable && (
          isEditing ? (
            <div className="mt-2 space-y-2">
              {isLoading ? (
                <div className="text-sm text-gray-400">Loading...</div>
              ) : availableOptions.length === 0 ? (
                <div className="text-sm text-gray-400">No available options</div>
              ) : (
                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-md divide-y">
                  {availableOptions.map(option => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleLink(option.id)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center space-x-2"
                    >
                      {getRelationIcon()}
                      <span>{option.name}</span>
                    </button>
                  ))}
                </div>
              )}
              
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="mt-2 inline-flex items-center text-sm text-indigo-600 hover:text-indigo-800"
            >
              <PlusCircleIcon className="h-4 w-4 mr-1" />
              Add {relationType === 'attendee' ? 'attendee' : relationType === 'conference' ? 'conference' : 'health system'}
            </button>
          )
        )}
      </div>
    );
  }
  
  // Render for single-relation field
  return (
    <div className="space-y-2">
      {label && <div className="text-sm font-medium text-gray-700">{label}</div>}
      
      {!isEditing ? (
        <div className="flex items-center justify-between">
          {current ? (
            <div 
              className="flex items-center space-x-2 text-sm text-gray-900 cursor-pointer hover:text-indigo-600"
              onClick={() => onItemClick?.(current.id, relationType)}
            >
              {getRelationIcon()}
              <span>{current.name}</span>
            </div>
          ) : (
            <div className="text-sm text-gray-400">{placeholder}</div>
          )}
          
          {editable && (
            current ? (
              <button
                type="button"
                onClick={() => handleUnlink(current.id)}
                className="text-gray-400 hover:text-red-500"
                disabled={isLoading}
              >
                <XCircleIcon className="h-5 w-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-800"
                disabled={isLoading}
              >
                <PlusCircleIcon className="h-4 w-4 mr-1" />
                Link
              </button>
            )
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {isLoading ? (
            <div className="text-sm text-gray-400">Loading...</div>
          ) : availableOptions.length === 0 ? (
            <div className="text-sm text-gray-400">No available options</div>
          ) : (
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-md divide-y">
              {availableOptions.map(option => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleLink(option.id)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center space-x-2"
                >
                  {getRelationIcon()}
                  <span>{option.name}</span>
                </button>
              ))}
            </div>
          )}
          
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 