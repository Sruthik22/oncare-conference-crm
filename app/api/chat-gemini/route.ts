import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// Initialize Gemini API client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: Request) {
  try {
    const { messages, activeTab } = await request.json();
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
    }

    // Prepare system message based on active tab
    let systemPrompt = '';
    let availableFilters: string[] = [];
    
    switch (activeTab) {
      case 'attendees':
        systemPrompt = `You are an AI assistant that helps users search through attendee records.
        Available properties to filter on include: first_name, last_name, email, phone, title, company.
        Users may ask questions about attendees based on attributes like their organization, title, or other info.`;
        availableFilters = [
          'first_name', 'last_name', 'email', 'phone', 'title', 'company'
        ];
        break;
      case 'health-systems':
        systemPrompt = `You are an AI assistant that helps users search through health system records.
        Available properties to filter on include: name, city, state, website, revenue.
        Users may ask questions about health systems based on location, size, revenue, etc.`;
        availableFilters = [
          'name', 'city', 'state', 'website', 'revenue'
        ];
        break;
      case 'conferences':
        systemPrompt = `You are an AI assistant that helps users search through conference records.
        Available properties to filter on include: name, location, start_date, end_date.
        Users may ask questions about conferences based on date, location, etc.`;
        availableFilters = [
          'name', 'location', 'start_date', 'end_date'
        ];
        break;
      default:
        systemPrompt = `You are an AI assistant that helps users search through records.`;
        availableFilters = [];
    }

    systemPrompt += `\n\nWhen a user asks a question that appears to be a search query, you should:
    1. Parse their natural language query to determine the appropriate filters
    2. Respond in a friendly way explaining how you're interpreting their query
    3. Return a JSON object with the appropriate filters to apply
    
    Available filters: ${JSON.stringify(availableFilters)}
    
    Use the following format for filters:
    {
      "filters": [
        { 
          "id": "unique-string-id",
          "property": "one-of-the-available-properties",
          "operator": "equals OR contains OR starts_with OR ends_with OR is_empty OR is_not_empty OR greater_than OR less_than",
          "value": "the-value-to-filter-for"
        }
      ]
    }
    
    If the user's query doesn't seem to be a search/filter request, just respond conversationally and return an empty filters array.
    
    The user's most recent message is: "${messages[messages.length - 1].content}"`;

    // Create a Gemini model instance
    const model = genAI.getGenerativeModel({ 
      model: "gemini-pro",
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
    });

    // Generate content
    const result = await model.generateContent(systemPrompt);
    const response = await result.response;
    const text = response.text();
    
    // Try to extract JSON from the response
    let filters = [];
    try {
      // Look for JSON object in the response
      const jsonMatch = text.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[0];
        const parsedData = JSON.parse(jsonStr);
        if (parsedData.filters && Array.isArray(parsedData.filters)) {
          filters = parsedData.filters;
        }
      }
      
      // If we found filters, create a clean response without the JSON
      let cleanResponse = text.replace(/\{[\s\S]*?\}/, '').trim();
      
      // If the clean response is empty, create a default message
      if (!cleanResponse) {
        cleanResponse = "I'll search based on your criteria.";
      }
      
      return NextResponse.json({
        text: cleanResponse,
        filters: filters,
      });
    } catch (e) {
      console.error('Error parsing Gemini response:', e);
      
      // Fall back to returning the full text
      return NextResponse.json({
        text: text,
        filters: [],
      });
    }
  } catch (error) {
    console.error('Error processing chat request:', error);
    return NextResponse.json(
      { error: 'An error occurred processing your request' },
      { status: 500 }
    );
  }
} 