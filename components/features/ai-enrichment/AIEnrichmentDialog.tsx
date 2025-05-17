import React, { useState, Fragment, FormEvent, useRef, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, ArrowPathIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { PaperAirplaneIcon } from '@heroicons/react/24/solid'
import { aiService } from '@/lib/ai'
import { definitiveService } from '@/lib/definitive'
import type { ColumnDef } from '@tanstack/react-table'
import type { Attendee, HealthSystem, Conference } from '@/types'
import type { IconName } from '@/hooks/useColumnManagement'
import { getColumnIconName } from '@/hooks/useColumnManagement'
import { Icon } from '@/components/ui/Icon'
import { getIconComponent } from '@/utils/iconUtils'
import { Switch } from '@headlessui/react'

// TODO: get icon path from iconUtils
// Helper function to get icon SVG path based on icon name
const getIconPath = (iconName: IconName): string => {
  switch (iconName) {
    case 'user':
      return "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z";
    case 'envelope':
      return "M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75";
    case 'phone':
      return "M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z";
    case 'building':
      return "M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z";
    case 'calendar':
      return "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5";
    case 'map-pin':
      return "M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z";
    case 'globe':
      return "M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418";
    case 'briefcase':
      return "M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z";
    case 'columns':
      return "M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z";
    case 'document-text':
      return "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z";
    case 'link':
      return "M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244";
    case 'identification':
      return "M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z";
    case 'clock':
      return "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z";
    case 'academic-cap':
      return "M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5";
    case 'currency-dollar':
      return "M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z";
    default:
      return "M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z"; // columns icon as default
  }
};

interface AIEnrichmentDialogProps {
  isOpen: boolean
  onClose: () => void
  items: Array<Attendee | HealthSystem | Conference>
  onEnrichmentComplete: (results: any[], columnName: string) => void
  allColumns?: ColumnDef<Attendee | HealthSystem | Conference>[]
  isLoading?: boolean
  getFieldsForAllColumns?: (item: Attendee | HealthSystem | Conference) => { id: string, label: string, value: string, iconName: IconName }[]
}

// Add batching utility
function chunkArray<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

export function AIEnrichmentDialog({ 
  isOpen, 
  onClose, 
  items, 
  onEnrichmentComplete,
  allColumns = [],
  isLoading = false,
  getFieldsForAllColumns
}: AIEnrichmentDialogProps) {
  const [columnName, setColumnName] = useState('')
  const [columnType, setColumnType] = useState('text')
  const [isEnriching, setIsEnriching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const [showVarMenu, setShowVarMenu] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
  const [filterText, setFilterText] = useState('')
  const [selectedVarIndex, setSelectedVarIndex] = useState(0)
  const [lastCursorPosition, setLastCursorPosition] = useState<{
    node: Node | null;
    offset: number;
  }>({ node: null, offset: 0 });
  const [includeDefinitiveData, setIncludeDefinitiveData] = useState(false)
  const [isLoadingDefinitiveData, setIsLoadingDefinitiveData] = useState(false)
  const [definitiveDataSummary, setDefinitiveDataSummary] = useState<string>("")
  const [progress, setProgress] = useState(0); // Progress for batches
  const [cancelRequested, setCancelRequested] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  
  const editorRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  
  // Get available variables from allColumns
  const availableVariables = allColumns.map(column => String(column.id));

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
    
    // Create icon element
    const iconSpan = document.createElement('span');
    iconSpan.className = 'mr-1 h-3.5 w-3.5 inline-block';
    iconSpan.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5 text-indigo-600"><path d="${getIconPath(getColumnIconName(variable))}"></path></svg>`;
    
    // Add icon and text to the variable tag
    varTag.appendChild(iconSpan);
    varTag.appendChild(document.createTextNode(variable));
    
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
    
    // Close menu
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
    
    // Create icon element
    const iconSpan = document.createElement('span');
    iconSpan.className = 'mr-1 h-3.5 w-3.5 inline-block';
    iconSpan.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5 text-indigo-600"><path d="${getIconPath(getColumnIconName(String(variable)))}"></path></svg>`;
    
    // Add icon and text to the variable tag
    varTag.appendChild(iconSpan);
    varTag.appendChild(document.createTextNode(variable));
    
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
    
    // Close menu
    setShowVarMenu(false);
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

  // Handle fetching Definitive data summary when toggle is enabled
  useEffect(() => {
    if (includeDefinitiveData) {
      fetchDefinitiveDataSummary();
    }
  }, [includeDefinitiveData]);

  // Fetch a summary of available Definitive data
  const fetchDefinitiveDataSummary = async () => {
    if (!includeDefinitiveData) return;
    
    try {
      setIsLoadingDefinitiveData(true);
      // Get a count or summary of the available health systems
      const healthSystems = await definitiveService.getAllHealthSystems();
      setDefinitiveDataSummary(`${healthSystems.length} health systems available from Definitive Healthcare`);
    } catch (error) {
      console.error('Error fetching Definitive data summary:', error);
      setDefinitiveDataSummary('Unable to load Definitive Healthcare data');
    } finally {
      setIsLoadingDefinitiveData(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      setIsEnriching(true)
      setError(null)
      setProgress(0)
      setCancelRequested(false)
      if (!columnName.trim()) {
        setError('Please enter a column name')
        return
      }
      const promptTemplate = getPromptTemplate();
      if (!promptTemplate.trim()) {
        setError('Please enter a prompt template')
        return
      }
      // Batching logic
      const batchSize = 20; // Adjust as needed
      const batches = chunkArray(items, batchSize);
      let allResults: any[] = [];
      for (let i = 0; i < batches.length; i++) {
        if (cancelRequested) {
          setError('Enrichment cancelled by user.');
          break;
        }
        const batch = batches[i];
        const results = await aiService.enrichItems({
          items: batch,
          promptTemplate,
          columnName,
          columnType,
          getFieldsForAllColumns,
          includeDefinitiveData
        });
        allResults = allResults.concat(results);
        setProgress((i + 1) / batches.length);
      }
      onEnrichmentComplete(allResults, columnName)
      onClose()
    } catch (err) {
      console.error('AI enrichment error:', err)
      setError(err instanceof Error ? err.message : 'An error occurred during enrichment')
    } finally {
      setIsEnriching(false)
      setCancelRequested(false)
      setShowCancelConfirm(false)
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
      
      // Test the prompt with proper typing
      const fields = getFieldsForAllColumns;
      
      // Test the prompt on the first item
      const result = await aiService.testPrompt(
        items[0],
        promptTemplate,
        columnName,
        columnType,
        fields,
        includeDefinitiveData
      )
      
      setTestResult(result)
    } catch (err) {
      console.error('Test prompt error:', err)
      setError(err instanceof Error ? err.message : 'An error occurred while testing the prompt')
    } finally {
      setIsTesting(false)
    }
  }

  // Handle cancel button click
  const handleCancelClick = () => {
    if (isEnriching) {
      setShowCancelConfirm(true);
    } else {
      onClose();
    }
  };

  const handleConfirmCancel = () => {
    setCancelRequested(true);
    setShowCancelConfirm(false);
  };

  const handleCancelDialogClose = () => {
    setShowCancelConfirm(false);
  };

  const closeButtonIcon = <XMarkIcon className="h-6 w-6" aria-hidden="true" />
  const processIcon = <ArrowPathIcon className="animate-spin -ml-0.5 mr-2 h-4 w-4" />
  const sendIcon = <PaperAirplaneIcon className="-ml-0.5 mr-2 h-4 w-4" />

  // Function to classify switch state
  function classNames(...classes: string[]) {
    return classes.filter(Boolean).join(' ')
  }

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
                    
                    {isLoading ? (
                      <div className="py-8 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
                        <p className="mt-2 text-sm text-gray-500">Loading data...</p>
                      </div>
                    ) : (
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
                          <div className="mt-2 relative">
                            <select
                              id="columnType"
                              value={columnType}
                              onChange={(e) => setColumnType(e.target.value)}
                              className="block w-full pl-3 pr-9 py-2.5 text-sm bg-white border border-gray-200 
                                        rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 
                                        focus:border-primary-500 transition-all duration-200 appearance-none"
                            >
                              <option value="text">Text</option>
                              <option value="boolean">Boolean (Yes/No)</option>
                              <option value="number">Number</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                              <svg className="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </div>
                        </div>
                        
                        <div className="mb-4">
                          <div className="flex items-center justify-between">
                            <span className="flex flex-grow items-center">
                              <span className="text-sm font-medium text-gray-700">Include Definitive Healthcare Data</span>
                              <span className="ml-2 text-xs text-gray-500">
                                {isLoadingDefinitiveData 
                                  ? "Loading..." 
                                  : includeDefinitiveData && definitiveDataSummary 
                                  ? definitiveDataSummary 
                                  : "Enhance matching with the Definitive Healthcare database"}
                              </span>
                            </span>
                            <Switch
                              checked={includeDefinitiveData}
                              onChange={setIncludeDefinitiveData}
                              className={classNames(
                                includeDefinitiveData ? 'bg-indigo-600' : 'bg-gray-200',
                                'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'
                              )}
                            >
                              <span className="sr-only">Use Definitive Healthcare data</span>
                              <span
                                aria-hidden="true"
                                className={classNames(
                                  includeDefinitiveData ? 'translate-x-5' : 'translate-x-0',
                                  'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                                )}
                              />
                            </Switch>
                          </div>
                          {includeDefinitiveData && (
                            <p className="mt-1 text-xs text-blue-600">
                              Your AI enrichment will include data from Definitive Healthcare to improve matching accuracy.
                            </p>
                          )}
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
                                        <Icon 
                                          icon={getIconComponent(getColumnIconName(variable))} 
                                          size="sm" 
                                          className="text-gray-500 mr-2 flex-shrink-0" 
                                        />
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
                            
                            {allColumns.length > 0 && (
                              <>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {allColumns.map(column => (
                                    <span
                                      key={String(column.id)}
                                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 cursor-pointer hover:bg-blue-200"
                                      onClick={() => insertAvailableVariable(String(column.id))}
                                    >
                                      <Icon 
                                        icon={getIconComponent(getColumnIconName(String(column.id)))} 
                                        size="xs" 
                                        className="text-blue-700 mr-1 flex-shrink-0" 
                                      />
                                      {String(column.header)}
                                    </span>
                                  ))}
                                </div>
                              </>
                            )}
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
                        
                        {isEnriching && (
                          <div className="mb-4">
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                              <div
                                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                                style={{ width: `${Math.round(progress * 100)}%` }}
                              />
                            </div>
                            <div className="text-xs text-gray-600 mt-1 text-center">
                              {Math.round(progress * 100)}% complete
                            </div>
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
                            disabled={isTesting || !items.length || isEnriching}
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
                            className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                            onClick={handleCancelClick}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
                {/* Cancel confirmation modal */}
                {showCancelConfirm && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
                    <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full">
                      <h3 className="text-lg font-semibold mb-2">Cancel Enrichment?</h3>
                      <p className="mb-4 text-gray-700">Are you sure you want to cancel the enrichment process? Progress will be lost.</p>
                      <div className="flex justify-end space-x-2">
                        <button
                          className="px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300"
                          onClick={handleCancelDialogClose}
                        >
                          No, keep running
                        </button>
                        <button
                          className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
                          onClick={handleConfirmCancel}
                        >
                          Yes, cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
} 