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
      const BATCH_SIZE = 10;
      const batches = [];
      
      // Split contacts into batches of 10
      for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
        batches.push(contacts.slice(i, i + BATCH_SIZE));
      }

      const allResults = [];
      
      // Process each batch
      for (const batch of batches) {
        const details = batch.map(contact => ({
          first_name: contact.firstName,
          last_name: contact.lastName,
          organization_name: contact.organization || '',
        }));

        const response = await this.client.post('', {
          endpoint: 'people/bulk_match',
          method: 'POST',
          data: { details }
        });

        if (response.data) {
          allResults.push(response.data);
        }
      }

      // Get all non-null matches from all results
      const allMatches = allResults
        .filter(result => result && result.matches)
        .flatMap(result => result.matches)
        .filter(match => match && Object.values(match).some(value => value !== null));

      return {
        status: 'success',
        error_code: null,
        error_message: null,
        total_requested_enrichments: contacts.length,
        unique_enriched_records: allMatches.length,
        missing_records: contacts.length - allMatches.length,
        credits_consumed: contacts.length,
        matches: allMatches
      };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error('Error enriching contacts:', error);
      if (error.response) {
        console.error('Error response data:', error.response.data);
        console.error('Error response status:', error.response.status);
      }
      throw error;
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
}

export const apolloService = ApolloService.getInstance(); 