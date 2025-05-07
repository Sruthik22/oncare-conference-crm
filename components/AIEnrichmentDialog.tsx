import React, { useState, Fragment, FormEvent, useRef, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, ArrowPathIcon, SparklesIcon } from '@heroicons/react/24/outline'
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
  const [promptText, setPromptText] = useState('')
  const [isEnriching, setIsEnriching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const [showVarMenu, setShowVarMenu] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
  const [filterText, setFilterText] = useState('')
  const [selectedVarIndex, setSelectedVarIndex] = useState(0)
  const [editorFocused, setEditorFocused] = useState(false)
  const [lastCursorPosition, setLastCursorPosition] = useState<{
    node: Node | null;
    offset: number;
  }>({ node: null, offset: 0 });
  
  const editorRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  
  // Get available variables from the first item
  const availableVariables = items.length > 0 
    ? Object.keys(items[0]).filter(key => 
        typeof items[0][key] === 'string' || 
        typeof items[0][key] === 'number' ||
        typeof items[0][key] === 'boolean'
      )
    : [];

  // Filter variables based on search text
  const filteredVariables = availableVariables.filter(variable => 
    filterText === '' || variable.toLowerCase().includes(filterText.toLowerCase())
  );

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current && 
        !menuRef.current.contains(event.target as Node) &&
        editorRef.current &&
        !editorRef.current.contains(event.target as Node)
      ) {
        setShowVarMenu(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Add custom CSS for placeholder
  useEffect(() => {
    // Add CSS for placeholder if it doesn't exist
    const styleId = 'contenteditable-placeholder-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
        [contenteditable=true]:empty:before {
          content: attr(data-placeholder);
          color: #9CA3AF;
          pointer-events: none;
          cursor: text;
        }
      `;
      document.head.appendChild(style);
    }
    
    return () => {
      // Clean up on unmount
      const styleElement = document.getElementById(styleId);
      if (styleElement) {
        styleElement.remove();
      }
    };
  }, []);

  // Extract text from editor including variables
  const getPromptTemplate = () => {
    if (!editorRef.current) return '';
    
    let template = '';
    const childNodes = Array.from(editorRef.current.childNodes);
    
    childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        template += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE && node instanceof HTMLElement) {
        const element = node as HTMLElement;
        if (element.classList.contains('variable-tag')) {
          const varName = element.getAttribute('data-variable');
          template += `{{${varName}}}`;
        } else {
          template += element.textContent;
        }
      }
    });
    
    return template;
  };

  // Handle @ symbol and show menu
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Store current cursor position on every keydown
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      setLastCursorPosition({
        node: range.startContainer,
        offset: range.startOffset
      });
    }
    
    // Handle keyboard navigation in menu
    if (showVarMenu) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedVarIndex(prev => Math.min(prev + 1, filteredVariables.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedVarIndex(prev => Math.max(0, prev - 1));
      } else if (e.key === 'Enter' && filteredVariables.length > 0) {
        e.preventDefault();
        insertVariable(filteredVariables[selectedVarIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowVarMenu(false);
      }
      return;
    }
    
    // Show menu when typing @
    if (e.key === '@') {
      setTimeout(() => {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          
          if (editorRef.current) {
            const editorRect = editorRef.current.getBoundingClientRect();
            setMenuPosition({
              top: rect.bottom - editorRect.top,
              left: rect.left - editorRect.left
            });
            setShowVarMenu(true);
            setFilterText('');
            setSelectedVarIndex(0);
          }
        }
      }, 0);
    }
    
    // Check for @ when pressing backspace
    if (e.key === 'Backspace') {
      setTimeout(() => {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          if (range.startContainer.nodeType === Node.TEXT_NODE) {
            const text = range.startContainer.textContent || '';
            const cursorPos = range.startOffset;
            
            // If cursor is right after @, show menu
            if (cursorPos > 0 && text.charAt(cursorPos - 1) === '@') {
              const rect = range.getBoundingClientRect();
              
              if (editorRef.current) {
                const editorRect = editorRef.current.getBoundingClientRect();
                setMenuPosition({
                  top: rect.bottom - editorRect.top,
                  left: rect.left - editorRect.left
                });
                setShowVarMenu(true);
                setFilterText('');
                setSelectedVarIndex(0);
              }
            }
          }
        }
      }, 0);
    }
  };

  // Handle editor focus events
  const handleEditorFocus = () => {
    setEditorFocused(true);
    
    // Store current cursor position on focus
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      setLastCursorPosition({
        node: range.startContainer,
        offset: range.startOffset
      });
    }
  };
  
  const handleEditorBlur = () => {
    setEditorFocused(false);
    
    // When editor loses focus, set cursor position to the end of the editor
    // This ensures that if we click on a variable outside the editor, it will append it
    if (editorRef.current) {
      // Find the last text node in the editor
      let lastNode: Node = editorRef.current;
      let lastChild = lastNode.lastChild;
      
      // Navigate to the deepest last child
      while (lastChild) {
        lastNode = lastChild;
        lastChild = lastNode.lastChild;
      }
      
      // Set cursor position to the end of this node
      const offset = lastNode.nodeType === Node.TEXT_NODE ? lastNode.textContent?.length || 0 : 0;
      
      setLastCursorPosition({
        node: lastNode,
        offset: offset
      });
    }
  };

  // Update filter text based on content after @
  const handleInput = () => {
    // Save the current content to promptText for API calls
    setPromptText(getPromptTemplate());
    
    // Store current cursor position
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      setLastCursorPosition({
        node: range.startContainer,
        offset: range.startOffset
      });
    }
    
    // Update filter if menu is open
    if (showVarMenu) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        
        if (range.startContainer.nodeType === Node.TEXT_NODE) {
          const text = range.startContainer.textContent || '';
          const cursorPos = range.startOffset;
          
          // Find @ before cursor
          const lastAtPos = text.lastIndexOf('@', cursorPos - 1);
          
          if (lastAtPos !== -1) {
            // Extract text between @ and cursor for filtering
            const filterStr = text.substring(lastAtPos + 1, cursorPos);
            setFilterText(filterStr);
            setSelectedVarIndex(0);
          } else {
            // No @ found, close menu
            setShowVarMenu(false);
          }
        } else {
          // Not in a text node, close menu
          setShowVarMenu(false);
        }
      }
    }
  };

  // Insert a variable at current cursor position
  const insertVariable = (variable: string) => {
    if (!editorRef.current) return;
    
    // Focus the editor first to ensure it receives the variable
    editorRef.current.focus();
    
    // Create variable tag element
    const varTag = document.createElement('span');
    varTag.className = 'inline-flex items-center mx-0.5 px-2 py-0.5 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800 variable-tag';
    varTag.contentEditable = 'false';
    varTag.setAttribute('data-variable', variable);
    varTag.textContent = variable;
    
    // Get the selection
    const selection = window.getSelection();
    if (!selection) return;
    
    // Create a new range
    let range = document.createRange();
    
    // Check if stored cursor position is inside the editor
    let isPositionInEditor = false;
    if (lastCursorPosition.node) {
      try {
        // Check if the node is inside the editor
        let node: Node | null = lastCursorPosition.node;
        while (node) {
          if (node === editorRef.current) {
            isPositionInEditor = true;
            break;
          }
          node = node.parentNode;
        }
        
        if (isPositionInEditor) {
          range.setStart(lastCursorPosition.node, lastCursorPosition.offset);
          range.setEnd(lastCursorPosition.node, lastCursorPosition.offset);
        } else {
          // Position not in editor, fall back to editor end
          range.selectNodeContents(editorRef.current);
          range.collapse(false);
        }
      } catch (e) {
        console.warn('Error restoring cursor position:', e);
        // Fallback to end of editor
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
      }
    } else {
      // Otherwise set at end of editor
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
    }
    
    // Set the selection to our range
    selection.removeAllRanges();
    selection.addRange(range);
    
    // If we're in menu mode, try to replace the @filter text
    if (showVarMenu && range.startContainer.nodeType === Node.TEXT_NODE) {
      const text = range.startContainer.textContent || '';
      const cursorPos = range.startOffset;
      const lastAtPos = text.lastIndexOf('@', cursorPos - 1);
      
      if (lastAtPos !== -1) {
        // Split text and replace @filter with variable tag
        const textBefore = text.substring(0, lastAtPos);
        const textAfter = text.substring(cursorPos);
        
        const textNode = range.startContainer;
        // Set the text content to exclude the @ symbol and filter text
        textNode.textContent = textBefore;
        
        // Insert variable tag
        const newRange = document.createRange();
        newRange.setStart(textNode, textBefore.length);
        newRange.setEnd(textNode, textBefore.length);
        newRange.insertNode(varTag);
        
        // Add text after the variable
        if (textAfter) {
          const afterTextNode = document.createTextNode(textAfter);
          varTag.parentNode?.insertBefore(afterTextNode, varTag.nextSibling);
        }
        
        // Position cursor after the variable
        const posRange = document.createRange();
        if (textAfter) {
          posRange.setStart(varTag.nextSibling as Node, 0);
        } else {
          posRange.setStartAfter(varTag);
        }
        posRange.collapse(true);
        
        selection.removeAllRanges();
        selection.addRange(posRange);
        
        // Store this as the new cursor position
        setLastCursorPosition({
          node: posRange.startContainer,
          offset: posRange.startOffset
        });
      } else {
        // Just insert at cursor
        range.insertNode(varTag);
        
        // Position cursor after the variable
        range.setStartAfter(varTag);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        
        // Store this as the new cursor position
        setLastCursorPosition({
          node: range.startContainer,
          offset: range.startOffset
        });
      }
    } else {
      // Just insert at cursor
      range.insertNode(varTag);
      
      // Position cursor after the variable
      range.setStartAfter(varTag);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      
      // Store this as the new cursor position
      setLastCursorPosition({
        node: range.startContainer,
        offset: range.startOffset
      });
    }
    
    // Update prompt text and close menu
    setPromptText(getPromptTemplate());
    setShowVarMenu(false);
  };

  // Insert a variable from the available variables section with a space after
  const insertAvailableVariable = (variable: string) => {
    if (!editorRef.current) return;
    
    // Focus the editor first to ensure it receives the variable
    editorRef.current.focus();
    
    // Create variable tag element
    const varTag = document.createElement('span');
    varTag.className = 'inline-flex items-center mx-0.5 px-2 py-0.5 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800 variable-tag';
    varTag.contentEditable = 'false';
    varTag.setAttribute('data-variable', variable);
    varTag.textContent = variable;
    
    // Get the selection
    const selection = window.getSelection();
    if (!selection) return;
    
    // Create a new range
    let range = document.createRange();
    
    // Check if stored cursor position is inside the editor
    let isPositionInEditor = false;
    if (lastCursorPosition.node) {
      try {
        // Check if the node is inside the editor
        let node: Node | null = lastCursorPosition.node;
        while (node) {
          if (node === editorRef.current) {
            isPositionInEditor = true;
            break;
          }
          node = node.parentNode;
        }
        
        if (isPositionInEditor) {
          range.setStart(lastCursorPosition.node, lastCursorPosition.offset);
          range.setEnd(lastCursorPosition.node, lastCursorPosition.offset);
        } else {
          // Position not in editor, fall back to editor end
          range.selectNodeContents(editorRef.current);
          range.collapse(false);
        }
      } catch (e) {
        console.warn('Error restoring cursor position:', e);
        // Fallback to end of editor
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
      }
    } else {
      // Otherwise set at end of editor
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
    }
    
    // Set the selection to our range
    selection.removeAllRanges();
    selection.addRange(range);
    
    // Check if there's content before the cursor
    const editorContent = editorRef.current.textContent || '';
    const hasContentBefore = editorContent.trim().length > 0;
    
    // Add a space before the variable if needed
    if (hasContentBefore) {
      // Get current position and check if we're not at the start of a text node
      const isAtStartOfNode = range.startContainer.nodeType === Node.TEXT_NODE && range.startOffset === 0;
      const isFirstNode = range.startContainer === editorRef.current && editorRef.current.childNodes.length === 0;
      
      // Only add a space if we're not at the start of a node or the editor
      if (!isAtStartOfNode && !isFirstNode) {
        // Check if there's already a space before
        const prevChar = getPreviousChar(range);
        if (prevChar !== ' ' && prevChar !== '\n' && prevChar !== '\t' && prevChar !== '') {
          const spaceNode = document.createTextNode(' ');
          range.insertNode(spaceNode);
          range.setStartAfter(spaceNode);
          range.setEndAfter(spaceNode);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
    }
    
    // Insert the variable tag
    range.insertNode(varTag);
    
    // Add a space after the variable
    const spaceNode = document.createTextNode(' ');
    varTag.parentNode?.insertBefore(spaceNode, varTag.nextSibling);
    
    // Position cursor after the space
    range.setStart(spaceNode, 1);
    range.setEnd(spaceNode, 1);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    
    // Store this as the new cursor position
    setLastCursorPosition({
      node: range.startContainer,
      offset: range.startOffset
    });
    
    // Update prompt text
    setPromptText(getPromptTemplate());
  };
  
  // Helper function to get the character before a range
  const getPreviousChar = (range: Range): string => {
    const { startContainer, startOffset } = range;
    
    // If we're in a text node and not at the beginning
    if (startContainer.nodeType === Node.TEXT_NODE && startOffset > 0) {
      return (startContainer.textContent || '').charAt(startOffset - 1);
    }
    
    // If we're at the beginning of a text node, look at previous node
    if (startContainer.nodeType === Node.TEXT_NODE && startOffset === 0) {
      const previousNode = getPreviousTextNode(startContainer);
      if (previousNode?.textContent) {
        return previousNode.textContent.charAt(previousNode.textContent.length - 1);
      }
    }
    
    return '';
  };
  
  // Helper function to get the previous text node
  const getPreviousTextNode = (node: Node): Node | null => {
    // If node has a previous sibling, get the deepest last child of it
    if (node.previousSibling) {
      let current = node.previousSibling;
      while (current.lastChild) {
        current = current.lastChild;
      }
      return current;
    }
    
    // If no previous sibling, go up to parent
    if (node.parentNode && node.parentNode !== editorRef.current) {
      return node.parentNode;
    }
    
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    
    try {
      setIsEnriching(true)
      setError(null)
      
      if (!columnName.trim()) {
        setError('Please enter a column name')
        return
      }
      
      const promptTemplate = getPromptTemplate();
      
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
      
      const promptTemplate = getPromptTemplate();
      
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
                    <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900 flex items-center">
                      <SparklesIcon className="h-5 w-5 text-blue-800 mr-1.5 inline-flex shrink-0" aria-hidden="true" />
                      Enrich with AI
                    </Dialog.Title>
                    
                    <form onSubmit={handleSubmit} className="mt-4">
                      <div className="mb-4">
                        <label htmlFor="columnName" className="block text-sm font-medium text-gray-700">
                          Column Name
                        </label>
                        <div className="mt-2 relative">
                          <input
                            type="text"
                            id="columnName"
                            value={columnName}
                            onChange={(e) => setColumnName(e.target.value)}
                            className="block w-full pl-3 pr-3 py-2.5 text-sm bg-white border border-gray-200 
                                      rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 
                                      focus:border-primary-500 transition-all duration-200"
                            placeholder="e.g., is_health_system"
                            required
                          />
                        </div>
                        <p className="mt-1 text-xs text-blue-600">
                          If this column doesn&apos;t exist, it will be automatically created in the database.
                        </p>
                      </div>
                      
                      <div className="mb-4">
                        <label htmlFor="columnType" className="block text-sm font-medium text-gray-700">
                          Column Type
                        </label>
                        <div className="mt-2">
                          <select
                            id="columnType"
                            value={columnType}
                            onChange={(e) => setColumnType(e.target.value)}
                            className="block w-full px-3 py-2.5 text-sm bg-white border border-gray-200 
                                      rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 
                                      focus:border-primary-500 transition-all duration-200"
                          >
                            <option value="text">Text</option>
                            <option value="boolean">Boolean (Yes/No)</option>
                            <option value="number">Number</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="mb-4">
                        <label htmlFor="promptTemplate" className="block text-sm font-medium text-gray-700">
                          Prompt Template
                        </label>
                        
                        <div className="relative">
                          {/* Rich editable prompt field */}
                          <div 
                            ref={editorRef}
                            contentEditable
                            className="mt-2 min-h-[160px] max-h-[320px] px-3 py-2.5 border border-gray-200 
                                      rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 
                                      focus:border-primary-500 transition-all duration-200 overflow-y-auto text-sm"
                            onInput={handleInput}
                            onKeyDown={handleKeyDown}
                            onFocus={handleEditorFocus}
                            onBlur={handleEditorBlur}
                            spellCheck="false"
                            data-placeholder="Enter your prompt here. Type @ to insert variables..."
                          ></div>
                          
                          {/* Variable selection menu */}
                          {showVarMenu && (
                            <div 
                              ref={menuRef}
                              className="absolute bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-[200px] overflow-y-auto w-60"
                              style={{ 
                                top: `${menuPosition.top}px`, 
                                left: `${menuPosition.left}px` 
                              }}
                            >
                              <ul className="py-1 text-sm">
                                {filteredVariables.length > 0 ? (
                                  filteredVariables.map((variable, index) => (
                                    <li 
                                      key={variable}
                                      className={`px-3 py-2 cursor-pointer flex items-center ${
                                        index === selectedVarIndex ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-100'
                                      }`}
                                      onClick={() => insertVariable(variable)}
                                    >
                                      <span className={index === selectedVarIndex ? 'font-medium' : ''}>{variable}</span>
                                    </li>
                                  ))
                                ) : (
                                  <li className="px-3 py-2 text-gray-500">No matching variables</li>
                                )}
                              </ul>
                            </div>
                          )}
                        </div>

                        <div className="mt-3">
                          <p className="text-xs text-gray-500">
                            <span className="font-medium">Available variables:</span> Type @ to access
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {availableVariables.map(variable => (
                              <span
                                key={variable}
                                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-800 cursor-pointer hover:bg-indigo-200"
                                onClick={() => insertAvailableVariable(variable)}
                              >
                                {variable}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="mt-3">
                          <p className="text-xs text-gray-500">
                            <span className="font-medium">Example prompt for health systems:</span> Is {'{{'} name {'}}' } a health system or healthcare provider? Research this organization and respond with yes or no.
                          </p>
                        </div>
                      </div>
                      
                      {testResult && (
                        <div className="mb-4 p-3 bg-gray-50 rounded-md border border-gray-200">
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
                        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md border border-red-200">
                          {error}
                        </div>
                      )}
                      
                      <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse space-x-3 space-x-reverse">
                        <button
                          type="submit"
                          disabled={isEnriching}
                          className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 sm:ml-3 sm:w-auto disabled:bg-indigo-300 disabled:cursor-not-allowed"
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
                          className="inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
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