import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';

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

  async pushContactsToApollo(contacts: ApolloContact[], tag: string): Promise<void> {
    try {
      console.warn('Pushing contacts to Apollo:', { contacts, tag });
      
      // First, create the tag if it doesn't exist
      await this.client.post('', {
        endpoint: 'tags',
        method: 'POST',
        data: { name: tag }
      });

      // Then, push contacts with the tag
      const response = await this.client.post('', {
        endpoint: 'people/bulk_create',
        method: 'POST',
        data: {
          people: contacts.map(contact => ({
            ...contact,
            tags: [tag],
          })),
        }
      });
      
      console.warn('Successfully pushed contacts to Apollo:', response.data);
    } catch (error) {
      console.error('Error pushing contacts to Apollo:', error);
      throw error;
    }
  }
}

export const apolloService = ApolloService.getInstance(); 