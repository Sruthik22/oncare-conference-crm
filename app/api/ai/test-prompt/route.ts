import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { item, promptTemplate, columnName, columnType } = await request.json();
    
    if (!item || typeof item !== 'object') {
      return NextResponse.json({ error: 'Invalid item format' }, { status: 400 });
    }

    if (!promptTemplate || typeof promptTemplate !== 'string') {
      return NextResponse.json({ error: 'Invalid prompt template' }, { status: 400 });
    }

    if (!columnName || typeof columnName !== 'string') {
      return NextResponse.json({ error: 'Invalid column name' }, { status: 400 });
    }

    if (!columnType || typeof columnType !== 'string') {
      return NextResponse.json({ error: 'Invalid column type' }, { status: 400 });
    }

    // Generate a prompt from the template by replacing variables
    let prompt = promptTemplate;
    
    // Replace all occurrences of variables in the format {{variableName}}
    // with the corresponding values from the item
    const variableRegex = /\{\{([^}]+)\}\}/g;
    prompt = prompt.replace(variableRegex, (_, variableName) => {
      const value = item[variableName] || '';
      return value;
    });

    // Add instructions based on column type
    let instructions = '';
    if (columnType === 'boolean') {
      instructions = 'Respond with only "yes" or "no".';
    } else if (columnType === 'number') {
      instructions = 'Respond with only a single number.';
    } else if (columnType === 'text') {
      instructions = 'Provide a concise, informative response.';
    }

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini-search-preview',
      messages: [
        {
          role: 'system',
          content: `You are an AI assistant helping to enrich data. ${instructions}`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 200,
    });

    // Extract the response
    const aiResponse = response.choices[0]?.message?.content?.trim() || '';
    
    // Process response based on column type
    let processedResponse;
    if (columnType === 'boolean') {
      processedResponse = aiResponse.toLowerCase() === 'yes';
    } else if (columnType === 'number') {
      processedResponse = parseFloat(aiResponse);
      if (isNaN(processedResponse)) {
        return NextResponse.json({ 
          error: 'AI did not return a valid number',
          rawResponse: aiResponse
        }, { status: 400 });
      }
    } else {
      processedResponse = aiResponse;
    }

    return NextResponse.json({
      success: true,
      result: processedResponse,
      rawResponse: aiResponse
    });
  } catch (error) {
    console.error('Error testing AI prompt:', error);
    return NextResponse.json(
      { error: 'An error occurred processing your request' },
      { status: 500 }
    );
  }
} 