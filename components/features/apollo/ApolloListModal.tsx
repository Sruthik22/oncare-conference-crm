import React, { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { apolloService, ApolloList } from '@/lib/apollo';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

interface ApolloListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onListSelected: (listName: string) => void;
  defaultListName?: string;
}

export default function ApolloListModal({ isOpen, onClose, onListSelected, defaultListName }: ApolloListModalProps) {
  const [lists, setLists] = useState<ApolloList[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newListName, setNewListName] = useState(defaultListName || '');
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [isDeletingList, setIsDeletingList] = useState(false);

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
      const fetchedLists = await apolloService.getLists();
      setLists(fetchedLists);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch lists');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateList = () => {
    if (!newListName.trim()) {
      setError('List name is required');
      return;
    }

    setIsCreatingList(true);
    setError(null);
    try {
      onListSelected(newListName.trim());
      setNewListName('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create list');
    } finally {
      setIsCreatingList(false);
    }
  };

  const handleDeleteList = async (listId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the list selection

    if (isDeletingList || !confirm('Are you sure you want to delete this list? This action cannot be undone.')) {
      return;
    }

    setIsDeletingList(true);
    setError(null);
    try {
      await apolloService.deleteList(listId);
      await fetchLists(); // Refresh the lists
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete list');
    } finally {
      setIsDeletingList(false);
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
                        <div key={list.id} className="flex items-center">
                          <button
                            onClick={() => {
                              onListSelected(list.name);
                              onClose();
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 rounded-md text-sm text-gray-700 flex items-center justify-between"
                          >
                            <span>{list.name}</span>
                            <span className="text-gray-500 text-xs">{list.count} contacts</span>
                          </button>
                          <button
                            onClick={(e) => handleDeleteList(list.id, e)}
                            disabled={isDeletingList}
                            className="ml-1 p-1 text-gray-400 hover:text-red-500 rounded-md"
                            title="Delete list"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
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