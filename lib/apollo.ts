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
  person: ApolloContact;
  organization: {
    id?: string;
    name: string;
    website_url: string;
    linkedin_url?: string;
    twitter_url?: string;
    facebook_url?: string;
    industry: string;
    estimated_num_employees: number;
    founded_year?: number;
    annual_revenue: number;
    total_funding: number;
    raw_address: string;
    raw_address_2: string;
    raw_city: string;
    short_description: string;
    keywords?: string[];
    technologies?: string[];
  };
}

interface ApolloSearchParams {
  firstName?: string;
  lastName?: string;
  organization?: string;
}

interface ApolloJob {
  title: string;
  organization_name: string;
  start_date: string;
  end_date: string | null;
  current: boolean;
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

  async enrichContacts(contacts: ApolloSearchParams[]): Promise<ApolloEnrichmentResponse[]> {
    try {
      const enrichedData: ApolloEnrichmentResponse[] = [];
      
      for (const contact of contacts) {
        const requestData: Record<string, string> = {};
        
        if (contact.firstName) requestData.first_name = contact.firstName;
        if (contact.lastName) requestData.last_name = contact.lastName;
        if (contact.organization) requestData.organization_name = contact.organization;
        
        const response = await this.client.post('', {
          endpoint: 'people/match',
          method: 'POST',
          data: requestData
        });
        
        if (response.data?.person) {
          const person = response.data.person;
          const org = person.organization || {};
          
          enrichedData.push({
            person: {
              id: person.id,
              firstName: person.first_name,
              lastName: person.last_name,
              name: person.name,
              email: person.email,
              email_status: person.email_status,
              title: person.title,
              headline: person.headline,
              organization: org.name || '',
              phone: person.phone || '',
              linkedinUrl: person.linkedin_url || '',
              photo_url: person.photo_url,
              twitter_url: person.twitter_url,
              facebook_url: person.facebook_url,
              github_url: person.github_url,
              city: person.city,
              state: person.state,
              country: person.country,
              departments: person.departments,
              subdepartments: person.subdepartments,
              functions: person.functions,
              seniority: person.seniority,
              employment_history: person.employment_history?.map((job: ApolloJob) => ({
                title: job.title,
                organization_name: job.organization_name,
                start_date: job.start_date,
                end_date: job.end_date,
                current: job.current
              }))
            },
            organization: {
              id: org.id,
              name: org.name || '',
              website_url: org.website_url || '',
              linkedin_url: org.linkedin_url,
              twitter_url: org.twitter_url,
              facebook_url: org.facebook_url,
              industry: org.industry || '',
              estimated_num_employees: org.estimated_num_employees || 0,
              founded_year: org.founded_year,
              annual_revenue: org.annual_revenue || 0,
              total_funding: org.total_funding || 0,
              raw_address: org.raw_address || '',
              raw_address_2: org.raw_address_2 || '',
              raw_city: org.raw_city || '',
              short_description: org.short_description || '',
              keywords: org.keywords,
              technologies: org.technology_names
            }
          });
        }
      }

      return enrichedData;
    } catch (error) {
      console.error('Error enriching contacts:', error);
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
      
      return response.data.contacts || [];
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