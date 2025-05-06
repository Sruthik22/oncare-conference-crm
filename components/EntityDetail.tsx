import { useState, Fragment, ReactNode, useEffect } from 'react'
import { 
  UserIcon, 
  BuildingOfficeIcon,
  PencilSquareIcon,
  CheckCircleIcon,
  XCircleIcon,
  CalendarIcon,
  PlusCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import { Icon } from '@/components/Icon'
import type { Attendee, Conference, HealthSystem } from '@/types'
import { supabase } from '@/lib/supabase'
import ApolloIntegration from './ApolloIntegration'
import { ApolloEnrichmentResponse } from '@/lib/apollo'
import { handleEnrichmentComplete as enrichAttendee } from '@/lib/enrichment'
import { Dialog, Transition } from '@headlessui/react'
import { DeleteResultsDialog } from './DeleteResultsDialog'

// Define the base entity types
export type EntityTypes = Attendee | Conference | HealthSystem
export type EntityTypeKeys = 'attendee' | 'conference' | 'healthSystem'

// Generic delete result type
export interface EntityDeleteResult {
  entity: EntityTypes
  success: boolean
  error?: string
  entityType: EntityTypeKeys
}

// Field definition for rendering dynamic fields
export interface FieldDefinition {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  label: string
  key: string
  type?: 'text' | 'email' | 'url' | 'date' | 'textarea' | 'phone'
  placeholder?: string
  render?: (value: any, entity: EntityTypes) => ReactNode
  editable?: boolean
  linkable?: boolean
}

// Tag definition for any linked entities
export interface TagDefinition {
  key: string
  getItems: (entity: EntityTypes) => any[]
  getLabel: (item: any) => string
  getColor: (index: number) => string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  onClick?: (item: any) => void
  labelKey: string
  removable?: boolean
  onRemove?: (item: any, entity: EntityTypes) => Promise<void>
  addable?: boolean
  onAdd?: (entity: EntityTypes, item: any) => Promise<void>
  getAvailableItems?: (entity: EntityTypes) => Promise<any[]>
  itemLabelKey?: string
  itemIdKey?: string
  getItemDisplayLabel?: (item: any) => string
}

interface EntityDetailProps {
  entity: EntityTypes
  entityType: EntityTypeKeys
  tableName: string
  iconColor: string
  fields: FieldDefinition[]
  tags?: TagDefinition[]
  title: (entity: EntityTypes) => string
  subtitle?: (entity: EntityTypes) => string | null
  onUpdate?: (updatedEntity: EntityTypes) => void
  onDelete?: (deletedEntityId: string) => void
  showApolloIntegration?: boolean
  conferenceName?: string
  fetchWithRelationships?: (entityId: string) => Promise<{ data: EntityTypes | null, error: any }>
  isNewEntity?: boolean
}

export const EntityDetail = ({
  entity,
  entityType,
  tableName,
  iconColor,
  fields,
  tags = [],
  title,
  subtitle,
  onUpdate,
  onDelete,
  showApolloIntegration = false,
  conferenceName,
  fetchWithRelationships,
  isNewEntity = false
}: EntityDetailProps) => {
  const [isEditing, setIsEditing] = useState(isNewEntity)
  const [editData, setEditData] = useState<EntityTypes | null>({ ...entity })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showDeleteResults, setShowDeleteResults] = useState(false)
  const [deleteResults, setDeleteResults] = useState<EntityDeleteResult[]>([])
  
  // New state for tag management
  const [availableTagItems, setAvailableTagItems] = useState<Record<string, any[]>>({})
  const [isAddingTag, setIsAddingTag] = useState<string | null>(null)
  const [showTagSelection, setShowTagSelection] = useState(false)
  const [selectedTagItem, setSelectedTagItem] = useState<any | null>(null)
  const [isTagActionInProgress, setIsTagActionInProgress] = useState(false)

  // Fetch available tag items when needed
  useEffect(() => {
    const fetchAvailableItems = async () => {
      // Skip API calls for new entities that aren't in the database yet
      if (isNewEntity) {
        return;
      }
      
      // Create an object to hold all tag options
      const tagItems: Record<string, any[]> = {};
      
      for (const tagDef of tags) {
        if (tagDef.addable && tagDef.getAvailableItems) {
          try {
            const items = await tagDef.getAvailableItems(entity);
            tagItems[tagDef.key] = items;
          } catch (err) {
            console.error(`Error fetching available items for ${tagDef.key}:`, err);
            tagItems[tagDef.key] = [];
          }
        }
      }
      
      setAvailableTagItems(tagItems);
    };
    
    if (tags.some(tag => tag.addable)) {
      fetchAvailableItems();
    }
  }, [entity, tags, isNewEntity]);

  // Handle adding a tag
  const handleAddTag = (tagKey: string) => {
    setIsAddingTag(tagKey);
    setShowTagSelection(true);
    
    // Skip API calls for new entities that aren't in the database yet
    if (isNewEntity) {
      setAvailableTagItems(prev => ({
        ...prev,
        [tagKey]: []
      }));
      return;
    }
    
    // Immediately fetch available items for this tag type
    const tagDef = tags.find(t => t.key === tagKey);
    if (tagDef?.addable && tagDef?.getAvailableItems) {
      tagDef.getAvailableItems(entity)
        .then(items => {
          setAvailableTagItems(prev => ({
            ...prev,
            [tagKey]: items
          }));
        })
        .catch(err => {
          console.error(`Error fetching available items for ${tagKey}:`, err);
          setAvailableTagItems(prev => ({
            ...prev,
            [tagKey]: []
          }));
        });
    }
  };

  // Handle selecting a tag item to add
  const handleTagItemSelect = (item: any) => {
    setSelectedTagItem(item);
  };

  // Handle confirming tag addition
  const handleTagAddConfirm = async () => {
    if (!isAddingTag || !selectedTagItem) return;
    
    const tagDef = tags.find(t => t.key === isAddingTag);
    if (!tagDef || !tagDef.onAdd) return;
    
    // // Skip API calls for new entities that aren't in the database yet
    // if (isNewEntity) {
    //   console.log('Cannot add relationship on a new entity that has not been saved');
    //   setError('Please save the entity first before adding relationships');
    //   setIsTagActionInProgress(false);
    //   return;
    // }
    
    setIsTagActionInProgress(true);
    setError(null);
    
    try {
      // Call the onAdd function provided by the tag definition
      await tagDef.onAdd(entity, selectedTagItem);
      
      // Refresh available items
      if (tagDef.getAvailableItems) {
        const items = await tagDef.getAvailableItems(entity);
        setAvailableTagItems(prev => ({
          ...prev,
          [tagDef.key]: items
        }));
      }
      
      // If update was successful and there's an onUpdate callback, refetch the entity
      if (onUpdate) {
        let data;
        let fetchError;
        
        // Use adapter-provided function if available, otherwise use type-specific queries
        if (fetchWithRelationships) {
          const result = await fetchWithRelationships(entity.id);
          data = result.data;
          fetchError = result.error;
        } else {
          // Fallback to type-specific queries if no custom fetch function provided
          if (entityType === 'attendee') {
            // For attendees, get health systems and conference relationships
            const response = await supabase
              .from(tableName)
              .select('*, health_systems(*), attendee_conferences(*, conferences(*))')
              .eq('id', entity.id)
              .single();
              
            data = response.data;
            fetchError = response.error;
          } else if (entityType === 'conference') {
            // For conferences, get attendee relationships
            const response = await supabase
              .from(tableName)
              .select('*, attendee_conferences(id, attendee_id, conference_id, attendees:attendees(id, first_name, last_name))')
              .eq('id', entity.id)
              .single();
            
            // Map the data structure to match what the component expects
            if (response.data && response.data.attendee_conferences) {
              response.data.attendee_conferences = response.data.attendee_conferences.map((ac: any) => ({
                ...ac,
                attendee: ac.attendees
              }));
            }
              
            data = response.data;
            fetchError = response.error;
          } else if (entityType === 'healthSystem') {
            // For health systems, get attendee relationships
            const healthSystemResponse = await supabase
              .from(tableName)
              .select('*')
              .eq('id', entity.id)
              .single();
            
            if (healthSystemResponse.error) {
              fetchError = healthSystemResponse.error;
            } else {
              // Fetch attendees linked to this health system
              const attendeesResponse = await supabase
                .from('attendees')
                .select('id, first_name, last_name, title, company')
                .eq('health_system_id', entity.id);
              
              if (attendeesResponse.error) {
                fetchError = attendeesResponse.error;
              } else {
                // Combine the data
                data = healthSystemResponse.data;
                data.attendees = attendeesResponse.data || [];
              }
            }
          } else {
            // For other entity types, just get the entity
            const response = await supabase
              .from(tableName)
              .select('*')
              .eq('id', entity.id)
              .single();
              
            data = response.data;
            fetchError = response.error;
          }
        }
        
        if (fetchError) {
          console.error(`Error fetching updated ${entityType} data:`, fetchError);
          throw fetchError;
        }
        
        if (data) {
          // Before updating state, ensure entity has been refreshed with latest data
          console.log(`Tag added successfully, updating UI with latest ${entityType} data:`, data);
          
          // Force a rerender by creating a completely new object
          const updatedEntity = {...data};
          
          // Call onUpdate with the new entity object
          onUpdate(updatedEntity);
        } else {
          console.error(`No data returned when fetching updated ${entityType}`);
        }
      }
      
      // Close the dialog
      setShowTagSelection(false);
      setSelectedTagItem(null);
      setIsAddingTag(null);
    } catch (err) {
      console.error(`Error adding tag to ${entityType}:`, err);
      setError(err instanceof Error ? err.message : 'An error occurred while adding the tag');
    } finally {
      setIsTagActionInProgress(false);
    }
  };

  // Handle removing a tag
  const handleRemoveTag = async (tagDef: TagDefinition, item: any) => {
    if (!tagDef.onRemove) return;
    
    // // Skip API calls for new entities that aren't in the database yet
    // if (isNewEntity) {
    //   console.log('Cannot remove relationship on a new entity that has not been saved');
    //   return;
    // }
    
    setIsTagActionInProgress(true);
    setError(null);
    
    try {
      // Call the onRemove function provided by the tag definition
      await tagDef.onRemove(item, entity);
      
      // If update was successful and there's an onUpdate callback, refetch the entity
      if (onUpdate) {
        let data;
        let fetchError;
        
        // Use adapter-provided function if available, otherwise use type-specific queries
        if (fetchWithRelationships) {
          const result = await fetchWithRelationships(entity.id);
          data = result.data;
          fetchError = result.error;
        } else {
          // Fallback to type-specific queries if no custom fetch function provided
          if (entityType === 'attendee') {
            // For attendees, get health systems and conference relationships
            const response = await supabase
              .from(tableName)
              .select('*, health_systems(*), attendee_conferences(*, conferences(*))')
              .eq('id', entity.id)
              .single();
              
            data = response.data;
            fetchError = response.error;
          } else if (entityType === 'conference') {
            // For conferences, get attendee relationships
            const response = await supabase
              .from(tableName)
              .select('*, attendee_conferences(id, attendee_id, conference_id, attendees:attendees(id, first_name, last_name))')
              .eq('id', entity.id)
              .single();
            
            // Map the data structure to match what the component expects
            if (response.data && response.data.attendee_conferences) {
              response.data.attendee_conferences = response.data.attendee_conferences.map((ac: any) => ({
                ...ac,
                attendee: ac.attendees
              }));
            }
              
            data = response.data;
            fetchError = response.error;
          } else if (entityType === 'healthSystem') {
            // For health systems, get attendee relationships
            const healthSystemResponse = await supabase
              .from(tableName)
              .select('*')
              .eq('id', entity.id)
              .single();
            
            if (healthSystemResponse.error) {
              fetchError = healthSystemResponse.error;
            } else {
              // Fetch attendees linked to this health system
              const attendeesResponse = await supabase
                .from('attendees')
                .select('id, first_name, last_name, title, company')
                .eq('health_system_id', entity.id);
              
              if (attendeesResponse.error) {
                fetchError = attendeesResponse.error;
              } else {
                // Combine the data
                data = healthSystemResponse.data;
                data.attendees = attendeesResponse.data || [];
              }
            }
          } else {
            // For other entity types, just get the entity
            const response = await supabase
              .from(tableName)
              .select('*')
              .eq('id', entity.id)
              .single();
              
            data = response.data;
            fetchError = response.error;
          }
        }
        
        if (fetchError) {
          console.error(`Error fetching updated ${entityType} data:`, fetchError);
          throw fetchError;
        }
        
        if (data) {
          // Before updating state, ensure entity has been refreshed with latest data
          console.log(`Tag removed successfully, updating UI with latest ${entityType} data:`, data);
          
          // Force a rerender by creating a completely new object
          const updatedEntity = {...data};
          
          // Call onUpdate with the new entity object
          onUpdate(updatedEntity);
          
          // Force rerender by updating a state variable
          setIsTagActionInProgress(false);
        } else {
          console.error(`No data returned when fetching updated ${entityType}`);
        }
      }
    } catch (err) {
      console.error(`Error removing tag from ${entityType}:`, err);
      setError(err instanceof Error ? err.message : 'An error occurred while removing the tag');
      setIsTagActionInProgress(false);
    }
  };

  // Handle edit click
  const handleEditClick = () => {
    setEditData({ ...entity })
    setIsEditing(true)
  }

  // Handle save changes
  const handleSaveChanges = async () => {
    if (!editData) return
    
    try {
      setIsSaving(true)
      setError(null)
      
      // Create a copy of editData to handle special cases
      const updateData = { ...editData }
      
      // Remove relationship fields that shouldn't be sent to the database
      if (entityType === 'attendee') {
        delete (updateData as any).attendee_conferences
        delete (updateData as any).health_systems
      } else if (entityType === 'conference') {
        // Remove relationship fields for conferences
        delete (updateData as any).attendee_conferences
        delete (updateData as any).attendees
      } else if (entityType === 'healthSystem') {
        // Remove relationship fields for health systems
        delete (updateData as any).attendees
      }
      
      const { data, error: updateError } = await supabase
        .from(tableName)
        .update(updateData)
        .eq('id', editData.id)
        .select()
      
      if (updateError) {
        console.error('Supabase update error:', updateError)
        throw updateError
      }
      
      if (!data || data.length === 0) {
        throw new Error('No data returned after update')
      }
      
      setIsEditing(false)
      
      // If update was successful and there's an onUpdate callback, call it
      if (data.length > 0 && onUpdate) {
        onUpdate(data[0])
      }
    } catch (err) {
      console.error('Full error object:', err)
      setError(err instanceof Error ? err.message : 'An error occurred while saving data')
    } finally {
      setIsSaving(false)
    }
  }
  
  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditData(null)
  }
  
  const handleDeleteConfirm = async () => {
    try {
      setIsDeleting(true)
      setError(null)
      
      const { error: deleteError } = await supabase
        .from(tableName)
        .delete()
        .eq('id', entity.id)
      
      if (deleteError) {
        console.error(`Supabase delete error:`, deleteError)
        
        // Store the failure result
        setDeleteResults([
          {
            entity,
            entityType,
            success: false,
            error: deleteError.message
          }
        ])
        
        throw deleteError
      }
      
      // Store the success result
      setDeleteResults([
        {
          entity,
          entityType,
          success: true
        }
      ])
      
      setShowDeleteConfirm(false)
      setShowDeleteResults(true)
      
      // If delete was successful and there's an onDelete callback, call it
      if (onDelete) {
        onDelete(entity.id)
      }
    } catch (err) {
      console.error('Delete error:', err)
      setError(err instanceof Error ? err.message : `An error occurred while deleting the ${entityType}`)
      setShowDeleteConfirm(false)
      setShowDeleteResults(true)
    } finally {
      setIsDeleting(false)
    }
  }
  
  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false)
  }
  
  const handleDeleteResultsClose = () => {
    setShowDeleteResults(false)
  }
  
  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setEditData((prev: EntityTypes | null) => {
      if (!prev) return null
      return {
        ...prev,
        [name]: value,
      }
    })
  }

  // Function to get icon based on entity type
  const getEntityIcon = () => {
    switch (entityType) {
      case 'attendee':
        return UserIcon
      case 'conference':
        return CalendarIcon
      case 'healthSystem':
        return BuildingOfficeIcon
      default:
        return UserIcon
    }
  }

  // Function to get background color for the icon
  const getIconBgColor = () => {
    switch (iconColor) {
      case 'gray':
        return 'bg-gray-100'
      case 'primary':
        return 'bg-primary-100'
      case 'secondary':
        return 'bg-secondary-100'
      case 'accent':
        return 'bg-accent-100'
      default:
        return 'bg-gray-100'
    }
  }

  // Function to get text color for the icon
  const getIconTextColor = () => {
    switch (iconColor) {
      case 'gray':
        return 'text-gray-500'
      case 'primary':
        return 'text-primary-600'
      case 'secondary':
        return 'text-secondary-600'
      case 'accent':
        return 'text-accent-600'
      default:
        return 'text-gray-500'
    }
  }

  const handleEnrichmentComplete = async (enrichedData: ApolloEnrichmentResponse) => {
    if (entityType !== 'attendee') return
    
    if (!enrichedData || !enrichedData.matches || enrichedData.matches.length === 0) {
      // Show a more informative message rather than an error
      setError('No matches found in Apollo for this contact. The contact information may be incomplete or not found in the database.');
      return;
    }

    try {
      await enrichAttendee(
        enrichedData,
        [entity as Attendee],
        (updatedAttendees: Attendee[]) => {
          if (updatedAttendees.length > 0) {
            // Update the local attendee state with the enriched data
            const updatedAttendee = updatedAttendees[0];
            // Notify parent component of the update
            onUpdate?.(updatedAttendee);
            setError(null);
          } else {
            setError('No attendees were updated');
          }
        }
      );
    } catch (err) {
      console.error('EntityDetail - Error in handleEnrichmentComplete:', err);
      setError(err instanceof Error ? err.message : 'Failed to update attendee with enriched data');
    }
  };

  // Tag selection dialog
  const TagSelectionDialog = () => {
    const tagDef = tags.find(t => t.key === isAddingTag);
    if (!tagDef) return null;
    
    const items = availableTagItems[tagDef.key] || [];
    
    return (
      <Transition.Root show={showTagSelection} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={() => setShowTagSelection(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-75 transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                  <div>
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                      <tagDef.icon className="h-6 w-6 text-blue-600" aria-hidden="true" />
                    </div>
                    <div className="mt-3 text-center sm:mt-5">
                      <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900">
                        Add {tagDef.labelKey}
                      </Dialog.Title>
                      <div className="mt-2">
                        <p className="text-sm text-gray-500">
                          Select a {tagDef.labelKey.toLowerCase()} to add to {title(entity)}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 max-h-60 overflow-y-auto">
                    <ul className="divide-y divide-gray-200">
                      {items.length > 0 ? (
                        items.map((item, index) => (
                          <li 
                            key={index} 
                            className={`flex items-center px-4 py-3 cursor-pointer ${
                              selectedTagItem === item 
                                ? 'bg-blue-50 hover:bg-blue-100' 
                                : 'hover:bg-gray-50'
                            }`}
                            onClick={() => handleTagItemSelect(item)}
                          >
                            <div className="flex-shrink-0">
                              <div className={`h-8 w-8 rounded-full ${tagDef.getColor(index)} flex items-center justify-center`}>
                                <tagDef.icon className="h-4 w-4" />
                              </div>
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-gray-900">
                                {tagDef.getItemDisplayLabel 
                                  ? tagDef.getItemDisplayLabel(item) 
                                  : tagDef.itemLabelKey 
                                    ? item[tagDef.itemLabelKey] 
                                    : tagDef.getLabel(item)
                                }
                              </p>
                            </div>
                          </li>
                        ))
                      ) : (
                        <li className="px-4 py-3 text-sm text-gray-500 text-center">
                          No available {tagDef.labelKey.toLowerCase()} found
                        </li>
                      )}
                    </ul>
                  </div>
                  
                  <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                    <button
                      type="button"
                      className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2"
                      onClick={handleTagAddConfirm}
                      disabled={isTagActionInProgress || !selectedTagItem}
                    >
                      {isTagActionInProgress ? 'Adding...' : 'Add'}
                    </button>
                    <button
                      type="button"
                      className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0"
                      onClick={() => {
                        setShowTagSelection(false);
                        setSelectedTagItem(null);
                        setIsAddingTag(null);
                      }}
                      disabled={isTagActionInProgress}
                    >
                      Cancel
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
    );
  };

  // Helper to generate human-readable labels from entity keys
  const toLabel = (key: string) =>
    key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase());

  if (isEditing && editData) {
    // Edit mode - render form with inputs
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 m-6 mb-0">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            </div>
          </div>
        )}
        
        <div className="border-b border-gray-200 p-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-full ${getIconBgColor()} flex items-center justify-center`}>
                <Icon icon={getEntityIcon()} size="md" className={getIconTextColor()} />
              </div>
              <div>
                <div className="flex gap-2">
                  <div className="mt-2">
                    <input
                      type="text"
                      name={Object.keys(entity).find(key => title(entity).includes((entity as any)[key])) || 'name'}
                      value={title(editData)}
                      onChange={handleInputChange}
                      className="block w-full rounded-md bg-white px-3 py-1.5 text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 sm:text-sm/6"
                      placeholder={`${entityType} Name`}
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={handleCancelEdit}
                className="inline-flex items-center gap-x-1.5 rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                disabled={isSaving}
              >
                <XCircleIcon className="-ml-0.5 h-5 w-5" aria-hidden="true" />
                Cancel
              </button>
              <button 
                onClick={handleSaveChanges}
                className="inline-flex items-center gap-x-1.5 rounded-md bg-indigo-600 px-2.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <svg className="-ml-0.5 h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="-ml-0.5 h-5 w-5" aria-hidden="true" />
                    Save
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        
        <div className="px-6 py-5 divide-y divide-gray-200">
          {fields.map((field, index) => (
            <div key={index} className="grid grid-cols-3 gap-6 py-4">
              <div className={`col-span-1 flex items-${field.type === 'textarea' ? 'start pt-2' : 'center'}`}>
                <field.icon className="h-5 w-5 text-gray-400 mr-2" />
                <label htmlFor={field.key} className="block text-sm font-medium text-gray-700">{field.label}</label>
              </div>
              <div className="col-span-2">
                {field.type === 'textarea' ? (
                  <div className="mt-2">
                    <textarea
                      name={field.key}
                      id={field.key}
                      rows={3}
                      value={(editData as any)[field.key] || ''}
                      onChange={handleInputChange}
                      className="block w-full rounded-md bg-white px-3 py-1.5 text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 sm:text-sm/6"
                      placeholder={field.placeholder || `Add ${field.label.toLowerCase()}`}
                    />
                  </div>
                ) : field.key.includes('.') ? (
                  // Handle nested objects like city/state
                  <div className="grid grid-cols-2 gap-4">
                    {field.key.split('.').map((nestedKey, nestedIdx) => (
                      <div key={nestedIdx} className="mt-2">
                        <input
                          type={field.type || 'text'}
                          name={nestedKey}
                          id={nestedKey}
                          value={(editData as any)[nestedKey] || ''}
                          onChange={handleInputChange}
                          className="block w-full rounded-md bg-white px-3 py-1.5 text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 sm:text-sm/6"
                          placeholder={field.placeholder?.split(',')[nestedIdx] || nestedKey}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2">
                    <input
                      type={field.type || 'text'}
                      name={field.key}
                      id={field.key}
                      value={(editData as any)[field.key] || ''}
                      onChange={handleInputChange}
                      className="block w-full rounded-md bg-white px-3 py-1.5 text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 sm:text-sm/6"
                      placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {/* Show tags in edit mode with ability to remove them */}
          {tags.map((tagDef, tagIdx) => {
            const items = tagDef.getItems(entity);
            
            return (
              <div key={tagIdx} className="grid grid-cols-3 gap-4 py-4">
                <div className="col-span-1 flex items-center">
                  <tagDef.icon className="h-5 w-5 text-gray-400 mr-2" />
                  <span className="text-sm font-medium text-gray-500">{tagDef.labelKey}</span>
                </div>
                <div className="col-span-2">
                  <div className="flex flex-wrap gap-2 items-center">
                    {items && items.length > 0 ? items.map((item, idx) => (
                      <span 
                        key={idx} 
                        className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${tagDef.onClick ? 'cursor-pointer' : ''} ${tagDef.getColor(idx)}`}
                      >
                        <div className="flex items-center">
                          <tagDef.icon className="h-4 w-4 mr-1" />
                          <span onClick={() => tagDef.onClick ? tagDef.onClick(item) : null}>
                            {tagDef.getLabel(item)}
                          </span>
                          {tagDef.removable && (
                            <button
                              onClick={() => handleRemoveTag(tagDef, item)}
                              className="ml-1 hover:text-red-700"
                              disabled={isTagActionInProgress}
                              title="Remove"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </span>
                    )) : (
                      <span className="text-gray-500 text-sm">No {tagDef.labelKey.toLowerCase()} associated</span>
                    )}
                    
                    {tagDef.addable && (
                      <button
                        onClick={() => handleAddTag(tagDef.key)}
                        className="inline-flex items-center px-2 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
                        disabled={isTagActionInProgress}
                      >
                        <PlusCircleIcon className="h-4 w-4 mr-1" />
                        Add {tagDef.labelKey}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Show Apollo Integration in edit mode too */}
        {showApolloIntegration && entityType === 'attendee' && (
          <div className="px-6 py-5 border-t border-gray-200">
            <ApolloIntegration
              selectedAttendees={[entity as Attendee]}
              conferenceName={conferenceName || 'Unknown Conference'}
              onEnrichmentComplete={handleEnrichmentComplete}
            />
          </div>
        )}
      </div>
    )
  }
  
  // View mode - render in description list format
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 m-6 mb-0">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      <div className="border-b border-gray-200 p-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className={`h-12 w-12 rounded-full ${getIconBgColor()} flex items-center justify-center`}>
              <Icon icon={getEntityIcon()} size="md" className={getIconTextColor()} />
            </div>
            <div>
              <h2 className="text-xl font-medium text-gray-900">
                {title(entity)}
              </h2>
              {subtitle && subtitle(entity) && (
                <p className="text-gray-500">{subtitle(entity)}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={handleEditClick}
              className="inline-flex items-center justify-center rounded-full bg-white p-1.5 text-gray-500 shadow-sm border border-gray-200 hover:text-gray-700 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              title="Edit"
            >
              <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Edit</span>
            </button>
            {onDelete && (
              <button 
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center justify-center rounded-full bg-white p-1.5 text-red-500 shadow-sm border border-gray-200 hover:text-red-700 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                title="Delete"
              >
                <XCircleIcon className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Delete</span>
              </button>
            )}
          </div>
        </div>
      </div>
      
      <div className="px-6 py-5 divide-y divide-gray-200">
        {fields.map((field, index) => {
          // Get field value 
          const value = (entity as any)[field.key];
          
          // Always render fields (even when empty) if editable is true
          const shouldRenderField = value || field.editable === true;
          if (!shouldRenderField) return null;
          
          return (
            <div key={index} className="grid grid-cols-3 gap-4 py-4">
              <div className={`col-span-1 flex items-${field.type === 'textarea' ? 'start pt-1' : 'center'}`}>
                <field.icon className="h-5 w-5 text-gray-400 mr-2" />
                <span className="text-sm font-medium text-gray-500">{field.label}</span>
              </div>
              <div className="col-span-2 text-sm">
                {field.render ? (
                  field.render(value, entity)
                ) : field.type === 'email' ? (
                  value ? <a href={`mailto:${value}`} className="text-primary-600 hover:text-primary-900">{value}</a> : '-'
                ) : field.type === 'phone' ? (
                  value ? <a href={`tel:${value}`} className="text-primary-600 hover:text-primary-900">{value}</a> : '-'
                ) : field.type === 'url' ? (
                  value ? <a href={value} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-900">{value}</a> : '-'
                ) : field.type === 'date' ? (
                  value ? new Date(value).toLocaleDateString() : '-'
                ) : field.type === 'textarea' ? (
                  value ? (
                    <div className="bg-gray-50 p-3 rounded-md">
                      <p className="whitespace-pre-line text-gray-700">{value}</p>
                    </div>
                  ) : '-'
                ) : (
                  <span className="text-gray-900">{value || '-'}</span>
                )}
              </div>
            </div>
          );
        })}
        
        {/* Auto-render any other entity properties */}
        {Object.entries(entity).map(([key, value]) => {
          if (fields.find(f => f.key === key)) return null;
          return (
            <div key={key} className="grid grid-cols-3 gap-4 py-4">
              <div className="col-span-1 flex items-center">
                <UserIcon className="h-5 w-5 text-gray-400 mr-2" />
                <span className="text-sm font-medium text-gray-500">{toLabel(key)}</span>
              </div>
              <div className="col-span-2 text-sm">
                {typeof value === 'object' ? (
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="whitespace-pre-line text-gray-700">{JSON.stringify(value, null, 2)}</p>
                  </div>
                ) : (
                  <span className="text-gray-900">{String(value)}</span>
                )}
              </div>
            </div>
          );
        })}

        {tags.map((tagDef, tagIdx) => {
          const items = tagDef.getItems(entity);
          
          return (
            <div key={tagIdx} className="grid grid-cols-3 gap-4 py-4">
              <div className="col-span-1 flex items-center">
                <tagDef.icon className="h-5 w-5 text-gray-400 mr-2" />
                <span className="text-sm font-medium text-gray-500">{tagDef.labelKey}</span>
              </div>
              <div className="col-span-2">
                <div className="flex flex-wrap gap-2 items-center">
                  {items && items.length > 0 ? items.map((item, idx) => (
                    <span 
                      key={idx} 
                      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${tagDef.onClick ? 'cursor-pointer' : ''} ${tagDef.getColor(idx)}`}
                    >
                      <div className="flex items-center">
                        <tagDef.icon className="h-4 w-4 mr-1" />
                        <span onClick={() => tagDef.onClick ? tagDef.onClick(item) : null}>
                          {tagDef.getLabel(item)}
                        </span>
                        {tagDef.removable && (
                          <button
                            onClick={() => handleRemoveTag(tagDef, item)}
                            className="ml-1 hover:text-red-700"
                            disabled={isTagActionInProgress}
                            title="Remove"
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </span>
                  )) : (
                    <span className="text-gray-500 text-sm">No {tagDef.labelKey.toLowerCase()} associated</span>
                  )}
                  
                  {tagDef.addable && (
                    <button
                      onClick={() => handleAddTag(tagDef.key)}
                      className="inline-flex items-center px-2 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
                      disabled={isTagActionInProgress}
                    >
                      <PlusCircleIcon className="h-4 w-4 mr-1" />
                      Add {tagDef.labelKey}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Add Apollo Integration section if needed */}
      {showApolloIntegration && entityType === 'attendee' && (
        <div className="px-6 py-5 border-t border-gray-200">
          <ApolloIntegration
            selectedAttendees={[entity as Attendee]}
            conferenceName={conferenceName || 'Unknown Conference'}
            onEnrichmentComplete={handleEnrichmentComplete}
          />
        </div>
      )}
      
      {/* Delete Confirmation Dialog */}
      <Transition.Root show={showDeleteConfirm} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={setShowDeleteConfirm}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-75 transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                  <div>
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                      <XCircleIcon className="h-6 w-6 text-red-600" aria-hidden="true" />
                    </div>
                    <div className="mt-3 text-center sm:mt-5">
                      <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900">
                        Remove {entityType.charAt(0).toUpperCase() + entityType.slice(1)}
                      </Dialog.Title>
                      <div className="mt-2">
                        <p className="text-sm text-gray-500">
                          Are you sure you want to delete {title(entity)}? This action cannot be undone.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                    <button
                      type="button"
                      className="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 sm:col-start-2"
                      onClick={handleDeleteConfirm}
                      disabled={isDeleting}
                    >
                      {isDeleting ? 'Deleting...' : 'Delete'}
                    </button>
                    <button
                      type="button"
                      className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0"
                      onClick={handleDeleteCancel}
                      disabled={isDeleting}
                    >
                      Cancel
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
      
      {/* Delete Results Dialog */}
      <DeleteResultsDialog 
        isOpen={showDeleteResults}
        onClose={handleDeleteResultsClose}
        results={deleteResults}
      />
      
      {/* Tag Selection Dialog */}
      <TagSelectionDialog />
    </div>
  )
} 