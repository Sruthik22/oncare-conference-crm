// Utility function to get all available columns for filtering based on the active tab
export function getAvailableFilters(activeTab: string): string[] {
  let availableFilters: string[] = [];
  
  // Default columns for each tab (fallback if we can't get all columns)
  const defaultColumns: Record<string, string[]> = {
    'attendees': [
      'first_name', 'last_name', 'name', 'email', 'phone', 'title', 'company',
      'city', 'state', 'address', 'zip', 'linkedin_url', 'created_at', 'updated_at'
    ],
    'health-systems': [
      'name', 'city', 'state', 'website', 'revenue', 'address', 'zip',
      'definitive_id', 'created_at', 'updated_at', 'location'
    ],
    'conferences': [
      'name', 'location', 'start_date', 'end_date', 'date',
      'city', 'state', 'address', 'created_at', 'updated_at'
    ]
  };

  // Get default columns based on activeTab
  if (activeTab in defaultColumns) {
    availableFilters = defaultColumns[activeTab];
  }
  
  // Add relationship fields for each tab
  switch (activeTab) {
    case 'attendees':
      // Add health system and conference relationships
      availableFilters.push(
        'health_system', 'conferences', 'health_systems'
      );
      break;
    case 'health-systems':
      // Add attendee and conference relationships
      availableFilters.push(
        'attendees', 'conferences'
      );
      break;
    case 'conferences':
      // Add attendee and health system relationships
      availableFilters.push(
        'attendees', 'health_systems'
      );
      break;
  }

  return availableFilters;
}

// Function to generate system message based on available filters
export function generateSystemMessage(activeTab: string, availableFilters: string[]): string {
  let systemMessage = '';
  
  switch (activeTab) {
    case 'attendees':
      systemMessage = `You are an AI assistant that helps users search through attendee records.
      Available properties to filter on include: ${availableFilters.join(', ')}.
      Users may ask questions about attendees based on attributes like their name, email, organization, title, location, or other info.`;
      break;
    case 'health-systems':
      systemMessage = `You are an AI assistant that helps users search through health system records.
      Available properties to filter on include: ${availableFilters.join(', ')}.
      Users may ask questions about health systems based on name, location, revenue, website, etc.`;
      break;
    case 'conferences':
      systemMessage = `You are an AI assistant that helps users search through conference records.
      Available properties to filter on include: ${availableFilters.join(', ')}.
      Users may ask questions about conferences based on name, date, location, etc.`;
      break;
    default:
      systemMessage = `You are an AI assistant that helps users search through records.
      Available properties to filter on include: ${availableFilters.join(', ')}.`;
  }

  systemMessage += `\n\nWhen a user asks a question that appears to be a search query, you should:
  1. Parse their natural language query to determine the appropriate filters
  2. Respond in a friendly way explaining how you're interpreting their query
  3. Return a JSON object in the "filters" field with the appropriate filters to apply
  
  Use the following format for filters:
  { 
    id: string (unique id),
    property: string (one of the available properties),
    operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'is_empty' | 'is_not_empty' | 'greater_than' | 'less_than',
    value: string (the value to filter for)
  }
  
  If the user's query doesn't seem to be a search/filter request, just respond conversationally and don't return any filters.`;

  return systemMessage;
} 