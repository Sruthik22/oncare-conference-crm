import React, { useState, Fragment, FormEvent } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, BookmarkIcon } from '@heroicons/react/24/outline'
import { aiPromptsService, CreateAIPromptData } from '@/lib/aiPrompts'

interface SavePromptDialogProps {
  isOpen: boolean
  onClose: () => void
  onSave: (savedPrompt: any) => void
  promptTemplate: string
  columnType: 'text' | 'boolean' | 'number'
  initialName?: string
}

export function SavePromptDialog({ 
  isOpen, 
  onClose, 
  onSave, 
  promptTemplate, 
  columnType,
  initialName = ''
}: SavePromptDialogProps) {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      setError('Please enter a name for the prompt')
      return
    }

    if (!promptTemplate.trim()) {
      setError('Prompt template cannot be empty')
      return
    }

    try {
      setIsSaving(true)
      setError(null)

      // Check if name already exists
      const nameExists = await aiPromptsService.promptNameExists(name.trim())
      if (nameExists) {
        setError('A prompt with this name already exists. Please choose a different name.')
        return
      }

      const promptData: CreateAIPromptData = {
        name: name.trim(),
        prompt_template: promptTemplate,
        column_type: columnType,
        description: description.trim() || undefined,
        is_default: false
      }

      const savedPrompt = await aiPromptsService.createPrompt(promptData)
      onSave(savedPrompt)
      onClose()
      
      // Reset form
      setName('')
      setDescription('')
      setError(null)
    } catch (err) {
      console.error('Error saving prompt:', err)
      setError(err instanceof Error ? err.message : 'Failed to save prompt')
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = () => {
    setName(initialName)
    setDescription('')
    setError(null)
    onClose()
  }

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-30 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
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
                <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
                  <button
                    type="button"
                    className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    onClick={handleClose}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>
                
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 sm:mx-0 sm:h-10 sm:w-10">
                    <BookmarkIcon className="h-6 w-6 text-indigo-600" aria-hidden="true" />
                  </div>
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                    <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900">
                      Save AI Prompt
                    </Dialog.Title>
                    
                    <form onSubmit={handleSubmit} className="mt-4">
                      <div className="mb-4">
                        <label htmlFor="promptName" className="block text-sm font-medium text-gray-700 mb-2">
                          Prompt Name *
                        </label>
                        <input
                          type="text"
                          id="promptName"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          placeholder="e.g., Health System Classifier"
                          required
                        />
                      </div>
                      
                      <div className="mb-4">
                        <label htmlFor="promptDescription" className="block text-sm font-medium text-gray-700 mb-2">
                          Description (optional)
                        </label>
                        <textarea
                          id="promptDescription"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          rows={3}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          placeholder="Describe what this prompt does..."
                        />
                      </div>

                      <div className="mb-4 p-3 bg-gray-50 rounded-md">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Prompt Preview</h4>
                        <div className="text-sm text-gray-600 max-h-20 overflow-y-auto">
                          <span className="font-medium">Type:</span> {columnType}<br />
                          <span className="font-medium">Template:</span> {promptTemplate.substring(0, 150)}{promptTemplate.length > 150 ? '...' : ''}
                        </div>
                      </div>

                      {error && (
                        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md border border-red-200 text-sm">
                          {error}
                        </div>
                      )}

                      <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                        <button
                          type="submit"
                          disabled={isSaving}
                          className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 sm:ml-3 sm:w-auto disabled:bg-indigo-300 disabled:cursor-not-allowed"
                        >
                          {isSaving ? (
                            <>
                              <span className="animate-spin -ml-0.5 mr-2 h-4 w-4">⌛</span>
                              Saving...
                            </>
                          ) : (
                            'Save Prompt'
                          )}
                        </button>
                        
                        <button
                          type="button"
                          className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                          onClick={handleClose}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
} 