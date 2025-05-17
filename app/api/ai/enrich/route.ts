import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { definitiveService, DefinitiveHospital } from '@/lib/definitive';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function to chunk array into batches
function chunkArray<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

export async function POST(request: Request) {
  try {
    const { items, promptTemplate, columnName, columnType, getFieldsForAllColumns, includeDefinitiveData } = await request.json();
    
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

    // Fetch Definitive data if requested - but just the names for initial filtering
    let definitiveData: DefinitiveHospital[] = [];
    let definitiveNames: string[] = [];
    if (includeDefinitiveData) {
      try {
        definitiveData = await definitiveService.getAllHealthSystems();
        definitiveNames = definitiveData.map(system => system.Name);
        console.log(`Fetched ${definitiveData.length} health system names from Definitive Healthcare`);
      } catch (error) {
        console.error('Error fetching Definitive data:', error);
        // Continue without Definitive data if there's an error
      }
    }

    // Prepare all items with their resolved prompts first
    const preparedItems = [];
    for (const item of items) {
      try {
        // Generate a prompt from the template by replacing variables (keep existing logic)
        let prompt = promptTemplate;
        
        // Replace all occurrences of variables in the format {{variableName}}
        const variableRegex = /\{\{([^}]+)\}\}/g;
        
        // Extract fieldsData for this item using getFieldsForAllColumns
        const fieldsData = getFieldsForAllColumns?.(item) || [];
        
        // Create a map of field id to value for easier lookup
        const fieldMap = new Map(
          fieldsData.map((field: { id: string, value: string }) => [field.id.toLowerCase(), field.value])
        );
        
        // Replace variables using the field map (keep existing logic)
        prompt = prompt.replace(variableRegex, (_, variableName) => {
          const key = variableName.toLowerCase();
          // Try to get the value from fieldMap first, fall back to direct property access
          return fieldMap.get(key) || item[variableName] || '';
        });

        // Add to prepared items
        preparedItems.push({
          id: item.id,
          prompt: prompt,
          originalItem: item
        });
      } catch (error) {
        console.error(`Error preparing item ${item.id}:`, error);
        // If an item fails preparation, still add it to results as failed
        preparedItems.push({
          id: item.id,
          error: error instanceof Error ? error.message : 'Error preparing item',
          originalItem: item
        });
      }
    }

    // Filter out items that failed preparation
    const validItems = preparedItems.filter(item => !item.error);
    const failedItems = preparedItems.filter(item => item.error);

    // Initialize results array with failed items
    const results: Array<{
      item: any;
      success: boolean;
      error?: string;
      enrichedData?: Record<string, any>;
    }> = failedItems.map(item => ({
      item: item.originalItem,
      success: false,
      error: item.error
    }));

    // Add instructions based on column type for system message
    let instructions = '';
    if (columnType === 'boolean') {
      instructions = 'Respond with only "yes" or "no".';
    } else if (columnType === 'number') {
      instructions = 'Respond with only a single number.';
    } else if (columnType === 'text') {
      instructions = 'Provide a concise, informative response.';
    }

    // Process in batches of 15 items
    const batchSize = 15;
    const batches = chunkArray(validItems, batchSize);
    
    for (const batch of batches) {
      try {
        // For each batch, create a multi-part prompt for the model
        const batchPrompt = batch.map((item, i) => `Item ${i+1} (ID: ${item.id}):\n${item.prompt}`).join('\n\n---\n\n');
        
        // Initial model - use gpt-3.5-turbo to save on costs
        const systemPrompt = `You are an AI assistant helping to enrich data. ${instructions}
Answer each of the following ${batch.length} items independently.
For each item, provide only the answer with no explanation or reasoning.
Always start your response to each item with "Item X (ID: [id]): " followed immediately by your answer.
Keep your answers as concise as possible.`;

        let definitiveSystemContent = '';
        if (includeDefinitiveData && definitiveNames.length > 0) {
          // For each batch item, try to find matches in Definitive data
          // First, extract potential organization names from the prompts
          const batchPromptForExtraction = batch.map((item, i) => 
            `Item ${i+1} (ID: ${item.id}):\nExtract company/organization names from: ${item.prompt}`
          ).join('\n\n---\n\n');
          
          // Extract organization names using a separate API call
          try {
            const extractionResponse = await openai.chat.completions.create({
              model: 'gpt-3.5-turbo',
              messages: [
                { 
                  role: 'system', 
                  content: `You are an extraction assistant. For each item, extract the name of any health system, hospital, or healthcare organization mentioned. 
Return ONLY the extracted name for each item with no additional text or explanation. If multiple names are mentioned, return the most prominent one. 
If no organization name is mentioned, respond with "NO_EXTRACTION_POSSIBLE".
Always start your response with "Item X (ID: [id]): " followed by the extracted name.` 
                },
                { role: 'user', content: batchPromptForExtraction }
              ],
              temperature: 0.1,
              max_tokens: 500,
            });
            
            const extractionContent = extractionResponse.choices[0].message.content || '';
            const extractRegex = /Item (\d+) \(ID: ([^)]+)\):\s*([\s\S]*?)(?=(?:Item \d+|$)|$)/g;
            
            // Process matches to find health systems
            const matchedSystems = [];
            let extractMatch;
            
            while ((extractMatch = extractRegex.exec(extractionContent + "\n")) !== null) {
              const [_, itemNum, itemId, extractedName] = extractMatch;
              
              if (extractedName && extractedName.trim() !== "NO_EXTRACTION_POSSIBLE") {
                // For each extracted name, look for matches in Definitive data
                const searchTerm = extractedName.trim();
                
                // Look for exact matches first
                let matches = definitiveData.filter(
                  system => system.Name.toLowerCase() === searchTerm.toLowerCase()
                );
                
                // If no exact matches, try contains matching
                if (matches.length === 0) {
                  matches = definitiveData.filter(
                    system => system.Name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                    searchTerm.toLowerCase().includes(system.Name.toLowerCase())
                  );
                }
                
                if (matches.length > 0) {
                  // Limit to first 2 matches to avoid overwhelming the context
                  for (const match of matches.slice(0, 2)) {
                    matchedSystems.push({
                      itemId,
                      system: match
                    });
                  }
                }
              }
            }
            
            // If we found matches, create a detailed system content
            if (matchedSystems.length > 0) {
              definitiveSystemContent = `You have access to healthcare system data from Definitive Healthcare. Here is information about specific health systems relevant to these items:\n\n`;
              
              // Group matches by item ID for clarity
              const systemsByItem: Record<string, DefinitiveHospital[]> = {};
              for (const match of matchedSystems) {
                if (!systemsByItem[match.itemId]) {
                  systemsByItem[match.itemId] = [];
                }
                systemsByItem[match.itemId].push(match.system);
              }
              
              // Create detailed content
              for (const [itemId, systems] of Object.entries(systemsByItem) as [string, DefinitiveHospital[]][]) {
                definitiveSystemContent += `For item ID ${itemId}:\n`;
                
                for (const system of systems) {
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
              }
              
              definitiveSystemContent += `Use this information to help with your classifications. Don't explicitly mention that you're using Definitive Healthcare data in your response.`;
            } else {
              // No matches found
              definitiveSystemContent = `You checked a database of ${definitiveNames.length} health systems and did not find any matches for the organizations mentioned. Please use your general knowledge to answer the questions.`;
            }
          } catch (extractError) {
            console.error('Error extracting organization names:', extractError);
            // Fallback to generic context
            definitiveSystemContent = `You have access to healthcare system data. Consider healthcare-specific factors when analyzing these items.`;
          }
        }

        // First pass with gpt-3.5-turbo (cheaper)
        const gpt35Response = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemPrompt + definitiveSystemContent },
            { role: 'user', content: batchPrompt }
          ],
          temperature: 0,
          max_tokens: 1024,
        });

        const gpt35Content = gpt35Response.choices[0].message.content || '';

        // Parse responses from GPT-3.5
        const responseRegex = /Item (\d+) \(ID: ([^)]+)\):\s*([\s\S]*?)(?=(?:Item \d+|$)|$)/g;
        const gpt35Results = [];
        const ambiguousItems = [];
        let match;

        while ((match = responseRegex.exec(gpt35Content + "\n")) !== null) {
          const [_, itemNum, itemId, itemResponse] = match;
          const originalBatchItem = batch.find(item => item.id === itemId);
          
          if (!originalBatchItem) continue;

          // Check if the response is ambiguous (for boolean type)
          let isAmbiguous = false;
          if (columnType === 'boolean') {
            const cleanResponse = itemResponse.trim().toLowerCase();
            if (cleanResponse !== 'yes' && cleanResponse !== 'no') {
              isAmbiguous = true;
              ambiguousItems.push(originalBatchItem);
            }
          }

          if (!isAmbiguous) {
            gpt35Results.push({
              id: itemId,
              response: itemResponse.trim(),
              originalItem: originalBatchItem.originalItem
            });
          }
        }

        // Process any ambiguous items with gpt-4o (higher quality, but more expensive)
        if (ambiguousItems.length > 0) {
          console.log(`Processing ${ambiguousItems.length} ambiguous items with gpt-4o`);
          const ambiguousPrompt = ambiguousItems.map((item, i) => `Item ${i+1} (ID: ${item.id}):\n${item.prompt}`).join('\n\n---\n\n');
          
          const gpt4oResponse = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: systemPrompt + definitiveSystemContent },
              { role: 'user', content: ambiguousPrompt }
            ],
            temperature: 0,
            max_tokens: 1024,
          });

          const gpt4oContent = gpt4oResponse.choices[0].message.content || '';

          // Parse responses from GPT-4o
          let fallbackMatch;
          const fallbackRegex = /Item (\d+) \(ID: ([^)]+)\):\s*([\s\S]*?)(?=(?:Item \d+|$)|$)/g;

          while ((fallbackMatch = fallbackRegex.exec(gpt4oContent + "\n")) !== null) {
            const [_, itemNum, itemId, itemResponse] = fallbackMatch;
            const originalBatchItem = ambiguousItems.find(item => item.id === itemId);
            
            if (originalBatchItem) {
              // Add GPT-4o result
              gpt35Results.push({
                id: itemId,
                response: itemResponse.trim(),
                originalItem: originalBatchItem.originalItem,
                source: 'gpt-4o' // Mark this as coming from the fallback model
              });
            }
          }
        }

        // Process and add all results from this batch
        for (const result of gpt35Results) {
          try {
            // Process response based on column type
            let processedResponse;
            if (columnType === 'boolean') {
              processedResponse = result.response.toLowerCase() === 'yes';
            } else if (columnType === 'number') {
              processedResponse = parseFloat(result.response);
              if (isNaN(processedResponse)) {
                throw new Error('AI did not return a valid number');
              }
            } else {
              processedResponse = result.response;
            }

            // Add to results
            results.push({
              item: result.originalItem,
              success: true,
              enrichedData: {
                [columnName]: processedResponse,
                _source: result.source || 'gpt-3.5-turbo' // Track which model provided this result
              }
            });
          } catch (error) {
            results.push({
              item: result.originalItem,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error processing response'
            });
          }
        }

        // Check for any missing items in this batch and mark them as failed
        for (const batchItem of batch) {
          if (!gpt35Results.some(result => result.id === batchItem.id)) {
            results.push({
              item: batchItem.originalItem,
              success: false,
              error: 'Failed to get a response from AI'
            });
          }
        }
      } catch (batchError) {
        console.error('Error processing batch:', batchError);
        // If a batch fails, mark all items in the batch as failed
        for (const batchItem of batch) {
          results.push({
            item: batchItem.originalItem,
            success: false,
            error: batchError instanceof Error ? batchError.message : 'Batch processing error'
          });
        }
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