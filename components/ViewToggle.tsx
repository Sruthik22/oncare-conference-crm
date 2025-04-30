interface ViewToggleProps {
  view: 'table' | 'cards'
  onViewChange: (view: 'table' | 'cards') => void
}

export function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <div className="flex items-center space-x-2">
      <button
        onClick={() => onViewChange('table')}
        className={`p-2 rounded-md ${
          view === 'table'
            ? 'bg-primary-100 text-primary-700'
            : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-300'
        } transition-colors`}
        aria-label="Table view"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18M3 18h18M3 6h18" />
        </svg>
      </button>
      
      <button
        onClick={() => onViewChange('cards')}
        className={`p-2 rounded-md ${
          view === 'cards'
            ? 'bg-primary-100 text-primary-700'
            : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-300'
        } transition-colors`}
        aria-label="Card view"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      </button>
    </div>
  )
} 