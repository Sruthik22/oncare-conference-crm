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

    // Handle processing with or without Definitive data
    let finalResponse;
    let matchInfo = "";

    if (includeDefinitiveData && definitiveNames.length > 0) {
      // First get the item name as a fallback
      const itemName = fieldMap.get('name') || item.name || '';
      
      // Extract potential matching terms from the prompt
      // This allows users to explicitly specify what to match in their prompts
      const extractionMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: `You are an extraction assistant. Extract the name of the health system, hospital, or healthcare organization that needs to be matched against a database. Return ONLY the name with no additional text or explanation. If multiple names are mentioned, list each one on a separate line. If no organization name is mentioned, respond with "NO_EXTRACTION_POSSIBLE".`
        },
        {
          role: 'user',
          content: prompt
        }
      ];
      
      // Call OpenAI API to extract matching terms
      const extractionResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: extractionMessages,
        max_tokens: 100,
        temperature: 0.1,
      });
      
      // Get the extraction result
      const extractionResult = extractionResponse.choices[0]?.message?.content?.trim() || '';
      matchInfo = `Extraction Result: ${extractionResult}`;
      
      // Use the extraction result if available, otherwise fall back to item name
      const searchTerms = extractionResult !== 'NO_EXTRACTION_POSSIBLE' ? 
        extractionResult.split('\n').filter(Boolean) : 
        (itemName ? [itemName] : []);
      
      if (searchTerms.length > 0) {
        // For each search term, check for matches
        let allMatchedNames: string[] = [];
        
        for (const searchTerm of searchTerms) {
          // STEP 1: Ask the AI to check if the term matches any health system name
          const matchMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
            {
              role: 'system',
              content: `You are a health system matching assistant. You have access to a database of health system names. Your task is to check if the provided health system name matches or is similar to any names in our database. IMPORTANT: Only return exact matches or very close matches. Don't return weak or questionable matches.`
            },
            {
              role: 'user',
              content: `Check if "${searchTerm}" matches or is very similar to any of the following health system names. If you find a match, respond ONLY with the matching name from the list, exactly as written. If there are multiple matches, list each one on a new line. If there are no matches, respond with "NO_MATCH".

Here is the full list of health system names to check against:
${definitiveNames.join('\n')}`
            }
          ];

          // Call OpenAI API for the match check
          const matchResponse = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: matchMessages,
            max_tokens: 100,
            temperature: 0.1, // Keep it focused and precise
          });

          // Extract the match response
          const matchResult = matchResponse.choices[0]?.message?.content?.trim() || '';
          matchInfo += `\nMatch Result for "${searchTerm}": ${matchResult}`;
          
          // If we found matches, add them to our list
          if (matchResult && matchResult !== 'NO_MATCH') {
            const matchedTerms = matchResult.split('\n').map(name => name.trim()).filter(Boolean);
            allMatchedNames = [...allMatchedNames, ...matchedTerms];
          }
        }
        
        // Remove duplicates
        allMatchedNames = allMatchedNames.filter((name, index, self) => 
          self.indexOf(name) === index
        );
        
        // If we found matches, proceed with the second API call
        if (allMatchedNames.length > 0) {
          matchInfo += `\nFinal Matches: ${allMatchedNames.join(', ')}`;
          
          // Find the matched systems in our data
          const matchedSystems = definitiveData.filter(system => 
            allMatchedNames.some(name => system.Name === name)
          );
          
          if (matchedSystems.length > 0) {
            // STEP 2: Second API call with the full context of matched systems
            const detailMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
              {
                role: 'system',
                content: `You are an AI assistant helping to enrich data. ${instructions}`
              },
              {
                role: 'system',
                content: `I found these detailed matches in the Definitive Healthcare database:
${matchedSystems.map((match, index) => `
Match ${index + 1}: ${match.Name}
- Type: ${match.FirmType || 'Unknown'}
- EMR Vendor (Ambulatory): ${match.EMRVendorAmbulatory || 'Unknown'}
- EMR Vendor (Inpatient): ${match.EMRVendorInpatient || 'Unknown'}
- Net Patient Revenue: ${match.NetPatientRev ? '$' + match.NetPatientRev.toLocaleString() : 'Unknown'}
- Number of Beds: ${match.NumBeds || 'Unknown'}
- Number of Hospitals: ${match.NumHospitals || 'Unknown'}
- Website: ${match.WebSite || 'Unknown'}
- Location: ${[match.HQCity, match.State].filter(Boolean).join(', ') || 'Unknown'}
`).join('\n')}

Use this information to help answer the question. Don't explicitly mention that you're using Definitive Healthcare data in your response.`
              },
              {
                role: 'user',
                content: prompt
              }
            ];

            // Call OpenAI API with the detailed context
            const detailResponse = await openai.chat.completions.create({
              model: 'gpt-4o-mini-search-preview',
              messages: detailMessages,
              max_tokens: 200,
            });

            finalResponse = detailResponse.choices[0]?.message?.content?.trim() || '';
          } else {
            // We got match names but couldn't find them in our data (shouldn't happen)
            console.warn(`Found matches ${allMatchedNames.join(', ')} but couldn't find them in definitiveData`);
            matchInfo += '\nWarning: Found matches but couldn\'t find them in definitiveData';
            
            // Fall back to the regular API call without Definitive data
            const regularMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
              {
                role: 'system',
                content: `You are an AI assistant helping to enrich data. ${instructions}`
              },
              {
                role: 'user',
                content: prompt
              }
            ];

            const regularResponse = await openai.chat.completions.create({
              model: 'gpt-4o-mini-search-preview',
              messages: regularMessages,
              max_tokens: 200,
            });

            finalResponse = regularResponse.choices[0]?.message?.content?.trim() || '';
          }
        } else {
          // No match found, use regular processing but tell the AI we checked
          matchInfo += '\nNo matches found in the database';
          
          const noMatchMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
            {
              role: 'system',
              content: `You are an AI assistant helping to enrich data. ${instructions}`
            },
            {
              role: 'system',
              content: `I checked our Definitive Healthcare database of ${definitiveNames.length} health systems and did not find any matches for the organizations mentioned in your query. Please use your general knowledge to answer the question.`
            },
            {
              role: 'user',
              content: prompt
            }
          ];

          const noMatchResponse = await openai.chat.completions.create({
            model: 'gpt-4o-mini-search-preview',
            messages: noMatchMessages,
            max_tokens: 200,
          });

          finalResponse = noMatchResponse.choices[0]?.message?.content?.trim() || '';
        }
      } else {
        // No terms to search with, use regular processing
        matchInfo += '\nNo organization names identified to match';
        
        const regularMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
          {
            role: 'system',
            content: `You are an AI assistant helping to enrich data. ${instructions}`
          },
          {
            role: 'user',
            content: prompt
          }
        ];

        const regularResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini-search-preview',
          messages: regularMessages,
          max_tokens: 200,
        });

        finalResponse = regularResponse.choices[0]?.message?.content?.trim() || '';
      }
    } else {
      // Regular processing without Definitive data
      const regularMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: `You are an AI assistant helping to enrich data. ${instructions}`
        },
        {
          role: 'user',
          content: prompt
        }
      ];

      const regularResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini-search-preview',
        messages: regularMessages,
        max_tokens: 200,
      });

      finalResponse = regularResponse.choices[0]?.message?.content?.trim() || '';
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
          matchInfo
        }, { status: 400 });
      }
    } else {
      processedResponse = finalResponse;
    }

    return NextResponse.json({
      success: true,
      result: processedResponse,
      rawResponse: finalResponse,
      matchInfo: matchInfo || undefined
    });
  } catch (error) {
    console.error('Error testing AI prompt:', error);
    return NextResponse.json(
      { error: 'An error occurred processing your request' },
      { status: 500 }
    );
  }
} 