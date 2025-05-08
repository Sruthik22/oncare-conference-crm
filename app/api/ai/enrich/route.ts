import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { items, promptTemplate, columnName, columnType, getFieldsForAllColumns } = await request.json();
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Invalid items format' }, { status: 400 });
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

    // Process each item with AI
    const results = [];
    for (const item of items) {
      try {
        // Generate a prompt from the template by replacing variables
        let prompt = promptTemplate;
        
        // Replace all occurrences of variables in the format {{variableName}}
        const variableRegex = /\{\{([^}]+)\}\}/g;
        
        // Extract fieldsData for this item using getFieldsForAllColumns
        const fieldsData = getFieldsForAllColumns?.(item) || [];
        
        // Create a map of field id to value for easier lookup
        const fieldMap = new Map(
          fieldsData.map((field: { id: string, value: string }) => [field.id.toLowerCase(), field.value])
        );
        
        // Replace variables using the field map
        prompt = prompt.replace(variableRegex, (_, variableName) => {
          const key = variableName.toLowerCase();
          // Try to get the value from fieldMap first, fall back to direct property access
          return fieldMap.get(key) || item[variableName] || '';
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
            throw new Error('AI did not return a valid number');
          }
        } else {
          processedResponse = aiResponse;
        }

        // Add to results
        results.push({
          item,
          success: true,
          enrichedData: {
            [columnName]: processedResponse
          }
        });
      } catch (itemError) {
        console.error('Error processing item:', itemError);
        results.push({
          item,
          success: false,
          error: itemError instanceof Error ? itemError.message : 'Unknown error occurred'
        });
      }
    }

    return NextResponse.json({
      results
    });
  } catch (error) {
    console.error('Error in AI enrichment:', error);
    return NextResponse.json(
      { error: 'An error occurred processing your request' },
      { status: 500 }
    );
  }
} 