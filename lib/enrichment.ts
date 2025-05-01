import type { Attendee } from '@/types'
import { supabase } from '@/lib/supabase'
import { ApolloEnrichmentResponse } from '@/lib/apollo'

export async function handleEnrichmentComplete(
  enrichedData: ApolloEnrichmentResponse,
  attendees: Attendee[],
  setAttendees: (attendees: Attendee[]) => void
) {
  try {
    // First, find which attendees have matches in the enriched data
    const attendeesToUpdate = attendees.filter(attendee => 
      enrichedData.matches.some(e => {
        const firstNameSimilarity = stringSimilarity(e.first_name.toLowerCase(), attendee.first_name.toLowerCase());
        const lastNameSimilarity = stringSimilarity(e.last_name.toLowerCase(), attendee.last_name.toLowerCase());
        return (lastNameSimilarity > 0.9 || e.last_name.toLowerCase() === attendee.last_name.toLowerCase()) 
          && firstNameSimilarity > 0.6;
      })
    );

    // Only process attendees that have matches
    const updatedAttendees = attendees.map(attendee => {
      const enriched = enrichedData.matches.find(e => {
        const firstNameSimilarity = stringSimilarity(e.first_name.toLowerCase(), attendee.first_name.toLowerCase());
        const lastNameSimilarity = stringSimilarity(e.last_name.toLowerCase(), attendee.last_name.toLowerCase());
        return (lastNameSimilarity > 0.9 || e.last_name.toLowerCase() === attendee.last_name.toLowerCase()) 
          && firstNameSimilarity > 0.6;
      });
      
      if (enriched) {
        const updates = {
          id: attendee.id,
          email: enriched.email || attendee.email,
          phone: enriched.phone || attendee.phone,
          title: enriched.headline || attendee.title,
          company: enriched.organization?.name || attendee.company,
          linkedin_url: enriched.linkedin_url || attendee.linkedin_url,
        }
        return {
          ...attendee,
          ...updates
        }
      }
      return attendee
    })

    // Only update attendees that have enriched data
    const updatePromises = attendeesToUpdate.map(async (attendee) => {
      const enriched = enrichedData.matches.find(e => {
        const firstNameSimilarity = stringSimilarity(e.first_name.toLowerCase(), attendee.first_name.toLowerCase());
        const lastNameSimilarity = stringSimilarity(e.last_name.toLowerCase(), attendee.last_name.toLowerCase());
        return (lastNameSimilarity > 0.9 || e.last_name.toLowerCase() === attendee.last_name.toLowerCase()) 
          && firstNameSimilarity > 0.6;
      });

      if (!enriched) return attendee;

      const updateData = {
        email: enriched.email || attendee.email,
        phone: enriched.phone || attendee.phone,
        title: enriched.headline || attendee.title,
        company: enriched.organization?.name || attendee.company,
        linkedin_url: enriched.linkedin_url || attendee.linkedin_url,
      }

      const { error } = await supabase
        .from('attendees')
        .update(updateData)
        .eq('id', attendee.id)

      if (error) {
        console.error('Supabase update error:', error)
        throw new Error(`Failed to update attendee ${attendee.id}: ${error.message}`)
      }
      return attendee
    })

    // Wait for all updates to complete
    await Promise.all(updatePromises)

    // Only update local state if all database updates were successful
    setAttendees(updatedAttendees)
  } catch (error) {
    console.error('Error during enrichment:', error)
    throw error
  }
}

function stringSimilarity(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));
  
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  return 1 - (matrix[len1][len2] / Math.max(len1, len2));
} 