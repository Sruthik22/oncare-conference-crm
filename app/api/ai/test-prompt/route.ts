import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { definitiveService, DefinitiveHospital } from '@/lib/definitive';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { item, promptTemplate, columnName, columnType, getFieldsForAllColumns, includeDefinitiveData } = await request.json();
    
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

    // Fetch Definitive data if requested - but just the names for initial filtering
    let definitiveData: DefinitiveHospital[] = [];
    let definitiveNames: string[] = [];
    if (includeDefinitiveData) {
      try {
        definitiveData = await definitiveService.getAllHealthSystems();
        definitiveNames = definitiveData.map(system => system.Name);
        console.log(`Fetched ${definitiveData.length} health system names from Definitive Healthcare for test`);
      } catch (error) {
        console.error('Error fetching Definitive data for test:', error);
        // Continue without Definitive data if there's an error
      }
    }
    
    // Generate a prompt from the template by replacing variables
    let prompt = promptTemplate;
    
    // Replace all occurrences of variables in the format {{variableName}}
    const variableRegex = /\{\{([^}]+)\}\}/g;
    
    // Extract fields data for this item using getFieldsForAllColumns
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

    // Create a system prompt similar to the enrich endpoint
    let systemPrompt = `You are an AI assistant helping to enrich data. ${instructions}
Provide only the answer with no explanation or reasoning.
Keep your answer as concise as possible.`;

    let definitiveSystemContent = '';
    let matchInfo = '';
    
    // Handle Definitive data in the same way as enrich endpoint
    if (includeDefinitiveData && definitiveNames.length > 0) {
      // For the single item, try to find matches in Definitive data
      // First, extract potential organization names from the prompt
      try {
        const extractionResponse = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            { 
              role: 'system', 
              content: `You are an extraction assistant. Extract the name of any health system, hospital, or healthcare organization mentioned. 
Return ONLY the extracted name with no additional text or explanation. If multiple names are mentioned, return the most prominent one. 
If no organization name is mentioned, respond with "NO_EXTRACTION_POSSIBLE".` 
            },
            { role: 'user', content: `Extract company/organization names from: ${prompt}` }
          ],
          temperature: 0.1,
          max_tokens: 100,
        });
        
        const extractedName = extractionResponse.choices[0].message.content?.trim() || '';
        matchInfo = `Extraction Result: ${extractedName}`;
        
        if (extractedName && extractedName !== "NO_EXTRACTION_POSSIBLE") {
          // Look for exact matches first
          let matches = definitiveData.filter(
            system => system.Name.toLowerCase() === extractedName.toLowerCase()
          );
          
          // If no exact matches, try contains matching
          if (matches.length === 0) {
            matches = definitiveData.filter(
              system => system.Name.toLowerCase().includes(extractedName.toLowerCase()) || 
              extractedName.toLowerCase().includes(system.Name.toLowerCase())
            );
          }
          
          if (matches.length > 0) {
            // Limit to first 3 matches to avoid overwhelming the context
            const limitedMatches = matches.slice(0, 3);
            matchInfo += `\nMatches found: ${limitedMatches.map(m => m.Name).join(', ')}`;
            
            // Create detailed system content
            definitiveSystemContent = `You have access to healthcare system data from Definitive Healthcare. Here is information about specific health systems relevant to this item:\n\n`;
            
            for (const system of limitedMatches) {
              definitiveSystemContent += `- ${system.Name}\n`;
              definitiveSystemContent += `  - Type: ${system.FirmType || 'Unknown'}\n`;
              definitiveSystemContent += `  - EMR Vendor (Ambulatory): ${system.EMRVendorAmbulatory || 'Unknown'}\n`;
              definitiveSystemContent += `  - EMR Vendor (Inpatient): ${system.EMRVendorInpatient || 'Unknown'}\n`;
              definitiveSystemContent += `  - Net Patient Revenue: ${system.NetPatientRev ? '$' + system.NetPatientRev.toLocaleString() : 'Unknown'}\n`;
              definitiveSystemContent += `  - Number of Beds: ${system.NumBeds || 'Unknown'}\n`;
              definitiveSystemContent += `  - Number of Hospitals: ${system.NumHospitals || 'Unknown'}\n`;
              definitiveSystemContent += `  - Website: ${system.WebSite || 'Unknown'}\n`;
              definitiveSystemContent += `  - Location: ${[system.HQCity, system.State].filter(Boolean).join(', ') || 'Unknown'}\n\n`;
            }
            
            definitiveSystemContent += `Use this information to help with your response. Don't explicitly mention that you're using Definitive Healthcare data in your response.`;
          } else {
            // No matches found
            definitiveSystemContent = `You checked a database of ${definitiveNames.length} health systems and did not find any matches for the organizations mentioned. Please use your general knowledge to answer the question.`;
            matchInfo += '\nNo matches found in the database';
          }
        } else {
          // No extraction possible
          definitiveSystemContent = `You checked a database of ${definitiveNames.length} health systems, but no organization name could be extracted from the prompt. Please use your general knowledge to answer the question.`;
          matchInfo += '\nNo organization names identified to match';
        }
      } catch (extractError) {
        console.error('Error extracting organization names:', extractError);
        // Fallback to generic context
        definitiveSystemContent = `You have access to healthcare system data. Consider healthcare-specific factors when analyzing this item.`;
        matchInfo += '\nError during extraction process';
      }
    }

    // First try with gpt-3.5-turbo (cheaper)
    const gpt35Response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt + (definitiveSystemContent ? '\n\n' + definitiveSystemContent : '') },
        { role: 'user', content: prompt }
      ],
      temperature: 0,
      max_tokens: 200,
    });

    const gpt35Content = gpt35Response.choices[0].message.content?.trim() || '';
    let finalResponse = gpt35Content;
    let modelUsed = 'gpt-3.5-turbo';

    // Check if the response is ambiguous (for boolean type) and fallback to gpt-4o if needed
    let isAmbiguous = false;
    if (columnType === 'boolean') {
      const cleanResponse = gpt35Content.trim().toLowerCase();
      if (cleanResponse !== 'yes' && cleanResponse !== 'no') {
        isAmbiguous = true;
      }
    }

    // For ambiguous responses or other complex cases, try with gpt-4o
    if (isAmbiguous) {
      matchInfo += '\nFalling back to gpt-4o due to ambiguous response from gpt-3.5-turbo';
      
      const gpt4oResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt + (definitiveSystemContent ? '\n\n' + definitiveSystemContent : '') },
          { role: 'user', content: prompt }
        ],
        temperature: 0,
        max_tokens: 200,
      });

      finalResponse = gpt4oResponse.choices[0].message.content?.trim() || '';
      modelUsed = 'gpt-4o';
    }
    
    // Process response based on column type
    let processedResponse;
    if (columnType === 'boolean') {
      processedResponse = finalResponse.toLowerCase() === 'yes';
    } else if (columnType === 'number') {
      processedResponse = parseFloat(finalResponse);
      if (isNaN(processedResponse)) {
        return NextResponse.json({ 
          error: 'AI did not return a valid number',
          rawResponse: finalResponse,
          matchInfo,
          modelUsed
        }, { status: 400 });
      }
    } else {
      processedResponse = finalResponse;
    }

    return NextResponse.json({
      success: true,
      result: processedResponse,
      rawResponse: finalResponse,
      matchInfo: matchInfo || undefined,
      modelUsed
    });
  } catch (error) {
    console.error('Error testing AI prompt:', error);
    return NextResponse.json(
      { error: 'An error occurred processing your request' },
      { status: 500 }
    );
  }
} 