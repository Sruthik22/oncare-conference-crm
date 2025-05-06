import React, { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { PlusIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { supabase } from '@/lib/supabase';

export interface List {
  id: string;
  name: string;
  count?: number;
}

interface ListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onListSelected: (listName: string) => void;
  defaultListName?: string;
  refreshLists?: () => Promise<void>;
}

export function ListModal({ isOpen, onClose, onListSelected, defaultListName, refreshLists }: ListModalProps) {
  const [lists, setLists] = useState<List[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newListName, setNewListName] = useState(defaultListName || '');
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (defaultListName) {
      setNewListName(defaultListName);
    }
  }, [defaultListName]);

  useEffect(() => {
    if (isOpen) {
      fetchLists();
    }
  }, [isOpen]);

  const fetchLists = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch all lists
      const { data: listsData, error: listsError } = await supabase
        .from('lists')
        .select('id, name')
        .order('name');
      
      if (listsError) throw new Error(listsError.message);
      
      if (!listsData) {
        setLists([]);
        return;
      }
      
      // Get counts for each list
      const listsWithCounts = await Promise.all(
        listsData.map(async (list) => {
          const { count, error: countError } = await supabase
            .from('attendee_lists')
            .select('id', { count: 'exact', head: true })
            .eq('list_id', list.id);
          
          return {
            ...list,
            count: countError ? 0 : count || 0
          };
        })
      );
      
      setLists(listsWithCounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch lists');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) {
      setError('List name is required');
      return;
    }

    setIsCreatingList(true);
    setError(null);
    try {
      // Create a list in the database
      const { error: newListError } = await supabase
        .from('lists')
        .insert({ name: newListName.trim() })
        .select('id')
        .single();
      
      if (newListError) {
        throw new Error(newListError.message);
      }
      
      // First refresh the lists in the parent components
      if (refreshLists) {
        await refreshLists();
      }
      
      // Then refresh the local list
      await fetchLists();
      
      // Call the onListSelected callback provided by the parent
      onListSelected(newListName.trim());
      setNewListName('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create list');
    } finally {
      setIsCreatingList(false);
    }
  };

  const handleSelectList = async (listName: string) => {
    try {
      // Call the onListSelected callback provided by the parent
      onListSelected(listName);
      
      // First refresh the lists in the parent components
      if (refreshLists) {
        await refreshLists();
      }
      
      onClose();
    } catch (err) {
      console.error('Error selecting list:', err);
    }
  };

  // Filter lists based on search term
  const filteredLists = lists.filter(list => 
    list.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-30" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-lg bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <SparklesIcon className="h-5 w-5 text-indigo-500 mr-2" />
                  Select or Create List
                </Dialog.Title>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
                    {error}
                  </div>
                )}

                <div className="mb-4">
                  <div className="flex items-center mb-2">
                    <input
                      type="text"
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      placeholder="New list name..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newListName.trim()) {
                          handleCreateList();
                        }
                      }}
                    />
                    <button
                      onClick={handleCreateList}
                      disabled={isCreatingList || !newListName.trim()}
                      className="ml-2 inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCreatingList ? (
                        <div className="animate-spin h-5 w-5 border-b-2 border-white rounded-full" />
                      ) : (
                        <PlusIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-900">Existing Lists</h3>
                    <div className="text-xs text-gray-500">
                      {filteredLists.length} list{filteredLists.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search lists..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  
                  {isLoading ? (
                    <div className="text-center py-6">
                      <div className="animate-spin h-8 w-8 border-b-2 border-indigo-500 rounded-full mx-auto"></div>
                      <p className="mt-2 text-sm text-gray-500">Loading lists...</p>
                    </div>
                  ) : filteredLists.length === 0 ? (
                    <div className="text-center py-6 bg-gray-50 rounded-md">
                      {searchTerm ? (
                        <p className="text-sm text-gray-500">No lists match your search</p>
                      ) : (
                        <p className="text-sm text-gray-500">No lists found. Create your first list above.</p>
                      )}
                    </div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto border border-gray-100 rounded-md">
                      {filteredLists.map((list) => (
                        <button
                          key={list.id}
                          onClick={() => handleSelectList(list.name)}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 text-sm text-gray-700 flex items-center justify-between group"
                        >
                          <div className="flex items-center">
                            <span className="font-medium group-hover:text-indigo-600">{list.name}</span>
                          </div>
                          <span className="text-gray-500 text-xs">{list.count} contact{list.count !== 1 ? 's' : ''}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 rounded-md"
                  >
                    Cancel
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
} 