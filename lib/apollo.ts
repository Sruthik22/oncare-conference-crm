import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';

export interface ApolloContactCreate {
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  title: string;
  organization: string;
  phone: string;
  linkedinUrl: string;
}

export interface ApolloContact {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  email_status?: string;
  title: string;
  headline?: string;
  organization: string;
  phone: string;
  linkedinUrl: string;
  photo_url?: string;
  twitter_url?: string;
  facebook_url?: string;
  github_url?: string;
  city?: string;
  state?: string;
  country?: string;
  departments?: string[];
  subdepartments?: string[];
  functions?: string[];
  seniority?: string;
  label_names?: string[];
  employment_history?: Array<{
    title: string;
    organization_name: string;
    start_date: string;
    end_date: string | null;
    current: boolean;
  }>;
}

export interface ApolloEnrichmentResponse {
  status: string;
  error_code: string | null;
  error_message: string | null;
  total_requested_enrichments: number;
  unique_enriched_records: number;
  missing_records: number;
  credits_consumed: number;
  matches: Array<{
    id: string;
    first_name: string;
    last_name: string;
    name: string;
    linkedin_url: string;
    title: string;
    headline: string;
    email_status: string;
    photo_url: string;
    email: string;
    phone: string;
    organization: {
      name: string;
      website_url: string;
      industry: string;
      estimated_num_employees: number;
    };
    employment_history: Array<{
      organization_name: string;
      title: string;
      start_date: string;
      end_date: string | null;
      current: boolean;
    }>;
  }>;
}

interface ApolloSearchParams {
  firstName?: string;
  lastName?: string;
  organization?: string;
  email?: string;
  phone?: string;
  title?: string;
  linkedinUrl?: string;
}

export interface ApolloList {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  count: number;
}

interface ApolloApiListResponse {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  cached_count: number;
  modality: string;
}

export class ApolloService {
  private static instance: ApolloService;
  private client: AxiosInstance;

  private constructor() {
    this.client = axios.create({
      baseURL: '/api/apollo',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor for debugging
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        console.warn('Apollo API Response:', {
          url: response.config.url,
          status: response.status,
          data: response.data,
        });
        return response;
      },
      (error: AxiosError) => {
        console.error('Apollo API Error:', {
          url: error.config?.url,
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
        throw error;
      }
    );
  }

  public static getInstance(): ApolloService {
    if (!ApolloService.instance) {
      ApolloService.instance = new ApolloService();
    }
    return ApolloService.instance;
  }

  async enrichContacts(contacts: ApolloSearchParams[]): Promise<ApolloEnrichmentResponse> {
    try {
      console.log(`🔍 Starting Apollo enrichment for ${contacts.length} contacts`);
      
      // For better candidate discovery, we'll use both individual match and bulk_match
      const allMatches: any[] = [];
      let totalEnriched = 0;
      
      // Strategy 1: Try bulk_match first (more efficient for multiple contacts)
      try {
        const bulkDetails = contacts.map(contact => ({
          first_name: contact.firstName,
          last_name: contact.lastName,
          organization_name: contact.organization || '',
          title: contact.title || '',
          email: contact.email || ''
        }));
        
        const bulkResponse = await this.client.post('', {
          endpoint: 'people/bulk_match',
          method: 'POST',
          data: { details: bulkDetails }
        });
        
        if (bulkResponse.data?.matches) {
          // Tag each match with its original contact for later filtering
          bulkResponse.data.matches.forEach((match: any, index: number) => {
            if (match && contacts[index]) {
              allMatches.push({
                ...match,
                _originalContact: contacts[index]
              });
            }
          });
          
          totalEnriched = bulkResponse.data.matches.filter((m: any) => m && Object.values(m).some(v => v !== null)).length;
          console.log(`✅ Bulk match found ${totalEnriched} enriched contacts`);
        }
      } catch (bulkError) {
        console.error('❌ Bulk match failed:', bulkError);
      }
      
      // Strategy 2: For contacts with no matches from bulk_match, try individual people/match
      const unmatchedContacts = contacts.filter((contact) => {
        const hasMatch = allMatches.some(match => 
          match._originalContact?.firstName === contact.firstName &&
          match._originalContact?.lastName === contact.lastName
        );
        return !hasMatch;
      });
      
      if (unmatchedContacts.length > 0) {
        console.log(`🎯 Trying individual match for ${unmatchedContacts.length} unmatched contacts...`);
        
        for (const contact of unmatchedContacts) {
          try {
            const individualMatches = await this.searchIndividualPerson(contact);
            
            if (individualMatches.length > 0) {
              // Tag candidates with original contact info
              const taggedMatches = individualMatches.map(match => ({
                ...match,
                _originalContact: contact
              }));
              
              allMatches.push(...taggedMatches);
              totalEnriched++;
            }
            
            // Rate limiting delay
            await new Promise(resolve => setTimeout(resolve, 100));
            
          } catch (individualError) {
            console.error(`Error searching individual contact ${contact.firstName} ${contact.lastName}:`, individualError);
          }
        }
      }
      
      console.log(`✅ Final enrichment results: ${allMatches.length} total candidates for ${contacts.length} contacts`);
      
      return {
        status: 'success',
        error_code: null,
        error_message: null,
        total_requested_enrichments: contacts.length,
        unique_enriched_records: totalEnriched,
        missing_records: contacts.length - totalEnriched,
        credits_consumed: contacts.length,
        matches: allMatches
      };
      
    } catch (error: any) {
      console.error('Error enriching contacts:', error);
      if (error.response) {
        console.error('Error response data:', error.response.data);
        console.error('Error response status:', error.response.status);
      }
      throw error;
    }
  }

  // New method for individual people/match search
  async searchIndividualPerson(contact: ApolloSearchParams): Promise<any[]> {
    try {
      const searchStrategies = [];
      
      // Strategy 1: People match with all available data
      if (contact.firstName && contact.lastName) {
        const matchData: any = {
          first_name: contact.firstName,
          last_name: contact.lastName
        };
        
        // Add optional fields if available
        if (contact.organization) matchData.organization_name = contact.organization;
        if (contact.title) matchData.title = contact.title;
        if (contact.email) matchData.email = contact.email;
        
        searchStrategies.push({
          endpoint: 'people/match',
          name: 'People Match - Full Data',
          data: matchData
        });
      }
      
      // Strategy 2: Email-only search (if we have email)
      if (contact.email) {
        searchStrategies.push({
          endpoint: 'people/match',
          name: 'People Match - Email Only',
          data: {
            email: contact.email
          }
        });
      }
      
      // Strategy 3: Name + oncology keywords search
      if (contact.firstName && contact.lastName) {
        searchStrategies.push({
          endpoint: 'people/match',
          name: 'People Match - Oncology Keywords',
          data: {
            first_name: contact.firstName,
            last_name: contact.lastName,
            q_keywords: 'oncology cancer hematology'
          }
        });
      }
      
      const candidates: any[] = [];
      const seenIds = new Set<string>();
      
      for (const strategy of searchStrategies) {
        try {
          const response = await this.client.post('', {
            endpoint: strategy.endpoint,
            method: 'POST',
            data: strategy.data
          });
          
          // Handle different response structures
          let matchResults: any[] = [];
          
          if (response.data?.person) {
            // Individual people/match returns {person: {...}}
            matchResults = [response.data.person];
          } else if (response.data?.matches) {
            matchResults = Array.isArray(response.data.matches) ? response.data.matches : [response.data.matches];
          } else if (response.data?.people) {
            matchResults = Array.isArray(response.data.people) ? response.data.people : [response.data.people];
          } else if (Array.isArray(response.data)) {
            matchResults = response.data;
          } else if (response.data && response.data.id) {
            matchResults = [response.data];
          }
          
          // Add unique candidates
          matchResults.forEach((candidate: any) => {
            if (candidate && candidate.id && !seenIds.has(candidate.id)) {
              seenIds.add(candidate.id);
              candidates.push(candidate);
            }
          });
          
          // Short delay between strategies
          await new Promise(resolve => setTimeout(resolve, 50));
          
        } catch (strategyError: any) {
          console.warn(`${strategy.name} failed:`, strategyError.message);
        }
      }
      
      return candidates.slice(0, 5); // Limit to top 5
      
    } catch (error) {
      console.error('Error in searchIndividualPerson:', error);
      return [];
    }
  }

  async searchContacts(searchParams: ApolloSearchParams[]): Promise<ApolloContact[]> {
    try {
      // Since we're searching for a single contact, use the first set of params
      const params = searchParams[0];
      const keywords = [
        params.firstName,
        params.lastName,
        params.organization
      ].filter(Boolean).join('; ');

      const response = await this.client.post('', {
        endpoint: 'contacts/search',
        method: 'POST',
        data: {
          q_keywords: keywords
        }
      });
      
      return response.data || [];
    } catch (error) {
      console.error('Error searching Apollo contacts:', error);
      throw error;
    }
  }

  async createContact(contact: ApolloContactCreate, labelNames: string[]): Promise<ApolloContact> {
    try {
      const response = await this.client.post('', {
        endpoint: 'contacts',
        method: 'POST',
        data: {
          ...contact,
          label_names: labelNames
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error creating Apollo contact:', error);
      throw error;
    }
  }

  async updateContact(contactId: string, labelNames: string[]): Promise<ApolloContact> {
    try {
      const response = await this.client.post('', {
        endpoint: `contacts/${contactId}`,
        method: 'PATCH',
        data: {
          label_names: labelNames
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error updating Apollo contact:', error);
      throw error;
    }
  }

  async pushContactsToApollo(contacts: ApolloContactCreate[], labelName: string): Promise<void> {
    try {
      console.warn('Pushing contacts to Apollo:', { contacts, labelName });
      
      for (const contact of contacts) {
        // Search for existing contact
        const existingContacts = await this.searchContacts([{
          firstName: contact.firstName,
          lastName: contact.lastName,
          organization: contact.organization
        }]);

        if (existingContacts.length > 0) {
          // Contact exists, update with new label while preserving existing labels
          const existingContact = existingContacts[0];
          const existingLabels = existingContact.label_names || [];
          const updatedLabels = Array.from(new Set([...existingLabels, labelName])); // Remove duplicates
          await this.updateContact(existingContact.id, updatedLabels);
        } else {
          // Contact doesn't exist, create new with label
          await this.createContact(contact, [labelName]);
        }
      }
      
      console.warn('Successfully pushed contacts to Apollo');
    } catch (error) {
      console.error('Error pushing contacts to Apollo:', error);
      throw error;
    }
  }

  async getLists(): Promise<ApolloList[]> {
    try {
      const response = await this.client.post('', {
        endpoint: 'labels',
        method: 'GET'
      });
      
      // Filter for contact lists only and map to our ApolloList interface
      return (response.data || [])
        .filter((list: ApolloApiListResponse) => list.modality === 'contacts')
        .map((list: ApolloApiListResponse) => ({
          id: list.id,
          name: list.name,
          created_at: list.created_at,
          updated_at: list.updated_at,
          count: list.cached_count || 0
        }));
    } catch (error) {
      console.error('Error fetching Apollo lists:', error);
      throw error;
    }
  }

  async createList(name: string): Promise<ApolloList> {
    try {
      const response = await this.client.post('', {
        endpoint: 'lists',
        method: 'POST',
        data: { name }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error creating Apollo list:', error);
      throw error;
    }
  }

  async addContactsToList(listId: string, contactIds: string[]): Promise<void> {
    try {
      await this.client.post('', {
        endpoint: `lists/${listId}/add_contacts`,
        method: 'PATCH',
        data: { contact_ids: contactIds }
      });
    } catch (error) {
      console.error('Error adding contacts to Apollo list:', error);
      throw error;
    }
  }

  async deleteList(listId: string): Promise<void> {
    try {
      await this.client.post('', {
        endpoint: `lists/${listId}`,
        method: 'DELETE'
      });
    } catch (error) {
      console.error('Error deleting Apollo list:', error);
      throw error;
    }
  }
}

export const apolloService = ApolloService.getInstance(); 