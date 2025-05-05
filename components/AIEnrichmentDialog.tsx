import React, { useState, Fragment, FormEvent } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { PaperAirplaneIcon } from '@heroicons/react/24/solid'
import { aiService } from '@/lib/ai'

interface AIEnrichmentDialogProps {
  isOpen: boolean
  onClose: () => void
  items: any[]
  onEnrichmentComplete: (results: any[], columnName: string) => void
}

export function AIEnrichmentDialog({ isOpen, onClose, items, onEnrichmentComplete }: AIEnrichmentDialogProps) {
  const [columnName, setColumnName] = useState('')
  const [columnType, setColumnType] = useState('text')
  const [promptTemplate, setPromptTemplate] = useState('')
  const [isEnriching, setIsEnriching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  
  // Get the properties of the first item to show as available variables
  const availableVariables = items.length > 0 
    ? Object.keys(items[0]).filter(key => 
        typeof items[0][key] === 'string' || 
        typeof items[0][key] === 'number' ||
        typeof items[0][key] === 'boolean'
      )
    : [];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    
    try {
      setIsEnriching(true)
      setError(null)
      
      if (!columnName.trim()) {
        setError('Please enter a column name')
        return
      }
      
      if (!promptTemplate.trim()) {
        setError('Please enter a prompt template')
        return
      }
      
      // Call AI service to perform enrichment
      const results = await aiService.enrichItems({
        items,
        promptTemplate,
        columnName,
        columnType
      })
      
      // Pass the results to the parent component
      onEnrichmentComplete(results, columnName)
      
      // Close the dialog
      onClose()
    } catch (err) {
      console.error('AI enrichment error:', err)
      setError(err instanceof Error ? err.message : 'An error occurred during enrichment')
    } finally {
      setIsEnriching(false)
    }
  }

  const handleTestPrompt = async () => {
    if (!items.length) return
    
    try {
      setIsTesting(true)
      setError(null)
      setTestResult(null)
      
      if (!columnName.trim()) {
        setError('Please enter a column name')
        return
      }
      
      if (!promptTemplate.trim()) {
        setError('Please enter a prompt template')
        return
      }
      
      // Test the prompt on the first item
      const result = await aiService.testPrompt(
        items[0],
        promptTemplate,
        columnName,
        columnType
      )
      
      setTestResult(result)
    } catch (err) {
      console.error('Test prompt error:', err)
      setError(err instanceof Error ? err.message : 'An error occurred while testing the prompt')
    } finally {
      setIsTesting(false)
    }
  }

  const closeButtonIcon = <XMarkIcon className="h-6 w-6" aria-hidden="true" />
  const processIcon = <ArrowPathIcon className="animate-spin -ml-0.5 mr-2 h-4 w-4" />
  const sendIcon = <PaperAirplaneIcon className="-ml-0.5 mr-2 h-4 w-4" />

  return (
    <Transition.Root show={isOpen} as={Fragment}>
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
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6">
                <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
                  <button
                    type="button"
                    className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    onClick={onClose}
                  >
                    <span className="sr-only">Close</span>
                    {closeButtonIcon}
                  </button>
                </div>
                
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                    <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900">
                      Enrich with AI
                    </Dialog.Title>
                    
                    <form onSubmit={handleSubmit} className="mt-4">
                      <div className="mb-4">
                        <label htmlFor="columnName" className="block text-sm font-medium text-gray-700">
                          Column Name
                        </label>
                        <input
                          type="text"
                          id="columnName"
                          value={columnName}
                          onChange={(e) => setColumnName(e.target.value)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          placeholder="e.g., is_health_system"
                          required
                        />
                        <p className="mt-1 text-xs text-blue-600">
                          If this column doesn&apos;t exist, it will be automatically created in the database.
                        </p>
                      </div>
                      
                      <div className="mb-4">
                        <label htmlFor="columnType" className="block text-sm font-medium text-gray-700">
                          Column Type
                        </label>
                        <select
                          id="columnType"
                          value={columnType}
                          onChange={(e) => setColumnType(e.target.value)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        >
                          <option value="text">Text</option>
                          <option value="boolean">Boolean (Yes/No)</option>
                          <option value="number">Number</option>
                        </select>
                      </div>
                      
                      <div className="mb-4">
                        <label htmlFor="promptTemplate" className="block text-sm font-medium text-gray-700">
                          Prompt Template
                        </label>
                        <textarea
                          id="promptTemplate"
                          value={promptTemplate}
                          onChange={(e) => setPromptTemplate(e.target.value)}
                          rows={5}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          placeholder="Enter your prompt here. Use {{variableName}} to reference item properties."
                          required
                        />
                        
                        {availableVariables.length > 0 && (
                          <div className="mt-2 text-xs text-gray-500">
                            <p className="font-medium">Available variables:</p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {availableVariables.map(variable => (
                                <span
                                  key={variable}
                                  className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 cursor-pointer hover:bg-gray-200"
                                  onClick={() => setPromptTemplate(prev => `${prev}{{${variable}}}`)}
                                >
                                  {variable}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="mt-3">
                          <p className="text-xs text-gray-500">
                            <span className="font-medium">Example prompt for health systems:</span> Is {'{{'} name {'}}' } a health system or healthcare provider? Research this organization and respond with yes or no.
                          </p>
                        </div>
                      </div>
                      
                      {testResult && (
                        <div className="mb-4 p-3 bg-gray-50 rounded-md">
                          <h4 className="text-sm font-medium text-gray-700">Test Result</h4>
                          <div className="mt-2">
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Raw response:</span> {testResult.rawResponse}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                              <span className="font-medium">Processed value:</span> {
                                typeof testResult.result === 'boolean' 
                                  ? (testResult.result ? 'Yes' : 'No')
                                  : String(testResult.result)
                              }
                            </p>
                          </div>
                        </div>
                      )}

                      {error && (
                        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">
                          {error}
                        </div>
                      )}
                      
                      <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse space-x-3 space-x-reverse">
                        <button
                          type="submit"
                          disabled={isEnriching}
                          className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 sm:ml-3 sm:w-auto"
                        >
                          {isEnriching ? (
                            <>
                              {processIcon}
                              Processing...
                            </>
                          ) : (
                            <>Enrich {items.length} items</>
                          )}
                        </button>
                        
                        <button
                          type="button"
                          onClick={handleTestPrompt}
                          disabled={isTesting || !items.length}
                          className="inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                        >
                          {isTesting ? (
                            <>
                              {processIcon}
                              Testing...
                            </>
                          ) : (
                            <>
                              {sendIcon}
                              Test on first item
                            </>
                          )}
                        </button>
                        
                        <button
                          type="button"
                          className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                          onClick={onClose}
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