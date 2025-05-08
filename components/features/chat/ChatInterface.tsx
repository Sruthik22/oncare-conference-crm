import { useState, useRef, useEffect } from 'react';
import { PaperAirplaneIcon, SparklesIcon, XMarkIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { Icon } from '@/components/ui/Icon';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatInterfaceProps {
  onSearch: (filters: Array<{
    id: string;
    property: string;
    operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'is_empty' | 'is_not_empty' | 'greater_than' | 'less_than';
    value: string;
  }>) => void;
  activeTab: 'attendees' | 'health-systems' | 'conferences';
  isLoading: boolean;
  isInSearchBar?: boolean;
}

export function ChatInterface({ onSearch, activeTab, isLoading, isInSearchBar = false }: ChatInterfaceProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isConversationMode, setIsConversationMode] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [useGemini, setUseGemini] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Scroll to bottom of chat when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // When a message is added, activate conversation mode
  useEffect(() => {
    if (messages.length > 0) {
      setIsConversationMode(true);
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    
    // Add user message to chat
    const userMessage = { role: 'user' as const, content: inputValue };
    setMessages([...messages, userMessage]);
    setInputValue('');
    setChatLoading(true);
    
    try {
      // Send request to the appropriate AI endpoint based on user preference
      const endpoint = useGemini ? '/api/chat-gemini' : '/api/chat';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          activeTab,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to get response from AI');
      }
      
      const data = await response.json();
      
      // Add AI response to chat
      setMessages(prevMessages => [...prevMessages, { 
        role: 'assistant', 
        content: data.text 
      }]);
      
      // Apply filters if provided
      if (data.filters && data.filters.length > 0) {
        onSearch(data.filters);
      }
    } catch (error) {
      console.error('Error querying AI:', error);
      setMessages(prevMessages => [...prevMessages, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error processing your request. Please try again.' 
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    // Only reset conversation if we're not in the search bar mode
    if (!isInSearchBar) {
      setMessages([]);
      setIsConversationMode(false);
    }
  };

  const resetConversation = () => {
    setMessages([]);
    setIsConversationMode(false);
  };

  // Model selector dropdown
  const renderModelSelector = () => (
    <div className="relative" ref={modelDropdownRef}>
      <button
        type="button"
        onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
        className="flex items-center text-xs text-gray-500 hover:text-gray-700 whitespace-nowrap"
      >
        <span className="mr-1">{useGemini ? 'Gemini' : 'OpenAI'}</span>
        <Icon icon={ChevronDownIcon} size="xs" className="w-3 h-3" />
      </button>
      
      {isModelDropdownOpen && (
        <div className="absolute right-0 mt-1 w-40 bg-white rounded-md shadow-lg z-50 border border-gray-200 py-1">
          <button
            className={`w-full text-left px-4 py-2 text-xs hover:bg-gray-100 ${!useGemini ? 'font-medium text-primary-700' : 'text-gray-700'}`}
            onClick={() => {
              setUseGemini(false);
              setIsModelDropdownOpen(false);
            }}
          >
            OpenAI GPT
          </button>
          <button
            className={`w-full text-left px-4 py-2 text-xs hover:bg-gray-100 ${useGemini ? 'font-medium text-primary-700' : 'text-gray-700'}`}
            onClick={() => {
              setUseGemini(true);
              setIsModelDropdownOpen(false);
            }}
          >
            Google Gemini
          </button>
        </div>
      )}
    </div>
  );

  // If integration with search bar is enabled, render a different UI
  if (isInSearchBar) {
    return (
      <div className={`w-full transition-all duration-300 ease-in-out ${isConversationMode ? 'max-h-[500px]' : 'max-h-12'}`}>
        <div className="relative w-full">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Icon icon={SparklesIcon} size="sm" className="text-gray-400" />
            </div>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask AI to find something..."
              className="block w-full pl-10 pr-10 py-2.5 text-sm bg-white border border-gray-200 
                        rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 
                        focus:border-primary-500 transition-all duration-200"
              disabled={chatLoading || isLoading}
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center space-x-3">
              {inputValue && (
                <button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || chatLoading || isLoading}
                  className="text-gray-400 hover:text-gray-600 flex items-center justify-center h-full"
                >
                  <Icon icon={PaperAirplaneIcon} size="sm" className="w-4 h-4" />
                </button>
              )}
              {isConversationMode && (
                <button 
                  onClick={resetConversation}
                  className="text-gray-400 hover:text-gray-600 flex items-center justify-center"
                  title="Reset conversation"
                >
                  <Icon icon={XMarkIcon} size="xs" />
                </button>
              )}
              {(!inputValue || !isConversationMode) && renderModelSelector()}
            </div>
          </div>
          
          {/* Conversation history (expanded mode) */}
          {isConversationMode && (
            <div className="mt-2 border border-gray-200 rounded-lg bg-white shadow-lg max-h-[400px] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2 bg-gray-50">
                <span className="text-xs font-medium text-gray-600">Conversation</span>
                <div className="flex items-center space-x-3">
                  {renderModelSelector()}
                  <button 
                    onClick={resetConversation}
                    className="text-gray-400 hover:text-gray-600 flex items-center justify-center"
                    title="Reset conversation"
                  >
                    <Icon icon={XMarkIcon} size="xs" />
                  </button>
                </div>
              </div>
              <div className="p-3 space-y-4">
                {messages.map((message, index) => (
                  <div 
                    key={index} 
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div 
                      className={`max-w-[80%] p-3 rounded-lg ${
                        message.role === 'user' 
                          ? 'bg-primary-50 text-gray-800 border border-primary-100' 
                          : 'bg-white border border-gray-200 text-gray-800 shadow-sm'
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] p-3 rounded-lg bg-white border border-gray-200 text-gray-800">
                      <div className="flex space-x-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary-300 animate-pulse"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-primary-300 animate-pulse delay-75"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-primary-300 animate-pulse delay-150"></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Floating button and chat interface for the original mode
  return (
    <div className="fixed bottom-24 right-4 z-50">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-primary-600 hover:bg-primary-700 text-white rounded-full p-3 shadow-lg flex items-center justify-center"
          aria-label="Open AI Chat"
        >
          <Icon icon={SparklesIcon} size="md" className="text-white" />
        </button>
      ) : (
        <div className="bg-white rounded-xl shadow-2xl w-80 sm:w-96 flex flex-col max-h-[500px] border border-gray-200 overflow-hidden">
          <div className="p-4 flex justify-between items-center bg-gradient-to-r from-primary-500 to-primary-600 text-white">
            <div className="flex items-center">
              <Icon icon={SparklesIcon} size="sm" className="text-white mr-2" />
              <h3 className="font-medium">AI Assistant</h3>
            </div>
            <div className="flex items-center space-x-2">
              <div className="relative" ref={modelDropdownRef}>
                <button
                  type="button"
                  className="text-white/80 hover:text-white flex items-center text-xs"
                  onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                >
                  <span className="mr-1">{useGemini ? 'Gemini' : 'OpenAI'}</span>
                  <Icon icon={ChevronDownIcon} size="xs" className="w-3 h-3" />
                </button>
                {isModelDropdownOpen && (
                  <div className="absolute right-0 mt-1 w-40 bg-white rounded-md shadow-lg z-50 border border-gray-200 py-1">
                    <button
                      className={`w-full text-left px-4 py-2 text-xs hover:bg-gray-100 ${!useGemini ? 'font-medium text-primary-700' : 'text-gray-700'}`}
                      onClick={() => {
                        setUseGemini(false);
                        setIsModelDropdownOpen(false);
                      }}
                    >
                      OpenAI GPT
                    </button>
                    <button
                      className={`w-full text-left px-4 py-2 text-xs hover:bg-gray-100 ${useGemini ? 'font-medium text-primary-700' : 'text-gray-700'}`}
                      onClick={() => {
                        setUseGemini(true);
                        setIsModelDropdownOpen(false);
                      }}
                    >
                      Google Gemini
                    </button>
                  </div>
                )}
              </div>
              <button 
                onClick={handleClose}
                className="text-white/80 hover:text-white"
              >
                <Icon icon={XMarkIcon} size="sm" />
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                <p>Ask me to help search or filter your data.</p>
                <p className="text-sm mt-2">
                  Example: Show me attendees from health systems with revenue over 5B
                </p>
              </div>
            ) : (
              messages.map((message, index) => (
                <div 
                  key={index} 
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-[80%] p-3 rounded-lg ${
                      message.role === 'user' 
                        ? 'bg-primary-50 text-gray-800 border border-primary-100' 
                        : 'bg-white border border-gray-200 text-gray-800 shadow-sm'
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))
            )}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="max-w-[80%] p-3 rounded-lg bg-white border border-gray-200 text-gray-800">
                  <div className="flex space-x-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary-300 animate-pulse"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-primary-300 animate-pulse delay-75"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-primary-300 animate-pulse delay-150"></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          <div className="p-3 border-t border-gray-200 bg-white">
            <div className="flex items-center">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question..."
                className="flex-1 border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none text-sm"
                rows={1}
                disabled={chatLoading || isLoading}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || chatLoading || isLoading}
                className={`ml-2 p-2 rounded-full flex items-center justify-center ${
                  !inputValue.trim() || chatLoading || isLoading
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-primary-600 text-white hover:bg-primary-700'
                }`}
              >
                <Icon icon={PaperAirplaneIcon} size="sm" className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 