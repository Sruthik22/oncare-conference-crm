import React, { useState, useEffect } from 'react';

interface LoadMoreButtonProps {
  onClick: () => void;
  isLoading: boolean;
  hasMore: boolean;
  currentPage?: number; // Optional prop to show current page for debugging
}

export function LoadMoreButton({ onClick, isLoading, hasMore, currentPage }: LoadMoreButtonProps) {
  // Local state to track button's loading state
  const [localLoading, setLocalLoading] = useState(false);
  
  // Reset local loading state when isLoading prop changes to false
  useEffect(() => {
    if (!isLoading && localLoading) {
      // Small delay to ensure the data has been rendered
      const timer = setTimeout(() => {
        setLocalLoading(false);
      }, 300);
      return () => clearTimeout(timer);
    }
    return () => {}
  }, [isLoading, localLoading]);

  const handleClick = () => {
    if (localLoading) return; // Prevent multiple clicks
    
    console.log('Load more button clicked, current page:', currentPage);
    setLocalLoading(true); // Set loading state immediately on click
    onClick();
  };

  if (!hasMore) {
    return (
      <div className="text-center py-4 text-gray-500 text-sm">
        No more items to load
      </div>
    );
  }

  return (
    <div className="text-center py-4">
      <button
        type="button"
        className="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        onClick={handleClick}
        disabled={localLoading || isLoading}
      >
        {localLoading || isLoading ? (
          <span className="flex items-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Loading...
          </span>
        ) : (
          `Load More${currentPage !== undefined ? ` (Page ${currentPage + 1})` : ''}`
        )}
      </button>
    </div>
  );
} 