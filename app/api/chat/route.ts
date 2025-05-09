import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getAvailableFilters, generateSystemMessage } from './utils';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { messages, activeTab } = await request.json();
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
    }

    // Get all available filters based on the active tab
    const availableFilters = getAvailableFilters(activeTab);
    
    // Generate system message with all available filters
    const systemMessage = generateSystemMessage(activeTab, availableFilters);

    // Add system message to conversation
    const fullMessages = [
      { role: 'system', content: systemMessage },
      ...messages
    ];

    // Call the OpenAI API
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-nano', // You can change to a different model if needed
      messages: fullMessages,
      temperature: 0.7,
      max_tokens: 500,
      function_call: { name: 'set_filters' },
      functions: [
        {
          name: 'set_filters',
          description: 'Set filters based on user query',
          parameters: {
            type: 'object',
            properties: {
              filters: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    property: { type: 'string', enum: availableFilters },
                    operator: { 
                      type: 'string', 
                      enum: ['equals', 'contains', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty', 'greater_than', 'less_than']
                    },
                    value: { type: 'string' }
                  },
                  required: ['id', 'property', 'operator', 'value']
                }
              }
            }
          }
        }
      ]
    });

    // Extract the response text and any filters
    let responseText = '';
    let filters = [];

    if (response.choices[0]?.message?.function_call) {
      // Parse the function call arguments
      try {
        const functionArgs = JSON.parse(response.choices[0].message.function_call.arguments);
        filters = functionArgs.filters || [];
        
        // Get the response text from the AI
        const followUpResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            ...fullMessages,
            {
              role: 'assistant',
              content: null,
              function_call: {
                name: 'set_filters',
                arguments: response.choices[0].message.function_call.arguments
              }
            },
            {
              role: 'system',
              content: `The filters have been set. Now please provide a user-friendly response explaining how you're interpreting their query.`
            }
          ],
          temperature: 0.7,
          max_tokens: 200,
        });
        
        responseText = followUpResponse.choices[0]?.message?.content || "I'll search based on your criteria.";
      } catch (e) {
        console.error('Error parsing function arguments:', e);
        responseText = 'I understand your query but had trouble creating the right filters. Could you phrase it differently?';
      }
    } else {
      // Just get the normal response text
      responseText = response.choices[0]?.message?.content || "I'm not sure how to help with that query.";
    }

    return NextResponse.json({
      text: responseText,
      filters: filters,
    });
  } catch (error) {
    console.error('Error processing chat request:', error);
    return NextResponse.json(
      { error: 'An error occurred processing your request' },
      { status: 500 }
    );
  }
} 