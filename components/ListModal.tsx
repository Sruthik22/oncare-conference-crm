import React, { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { PlusIcon } from '@heroicons/react/24/outline';
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
        .select('id, name');
      
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
                <Dialog.Title className="text-lg font-medium text-gray-900 mb-4">
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
                    />
                    <button
                      onClick={handleCreateList}
                      disabled={isCreatingList || !newListName.trim()}
                      className="ml-2 inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCreatingList ? (
                        <span className="animate-spin">⌛</span>
                      ) : (
                        <PlusIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Existing Lists</h3>
                  {isLoading ? (
                    <div className="text-center py-4">
                      <span className="animate-spin">⌛</span>
                      <span className="ml-2 text-gray-500">Loading lists...</span>
                    </div>
                  ) : lists.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">No lists found</p>
                  ) : (
                    <div className="max-h-60 overflow-y-auto">
                      {lists.map((list) => (
                        <button
                          key={list.id}
                          onClick={() => handleSelectList(list.name)}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 rounded-md text-sm text-gray-700 flex items-center justify-between"
                        >
                          <span>{list.name}</span>
                          <span className="text-gray-500 text-xs">{list.count} contacts</span>
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