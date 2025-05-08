import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';

// Interfaces for Definitive API types
export interface DefinitiveHospitalSearchResult {
  value: DefinitiveHospital[];
  '@odata.context'?: string;
}

export interface DefinitiveHospital {
  Id: number;
  Name: string;
  FirmType?: string;
  WebSite?: string;
  Address?: string;
  Address1?: string;
  HQCity?: string;
  State?: string;
  Zip?: string;
  CountryCode?: string;
  Phone?: string;
  NetPatientRev?: number;
  NetworkName?: string;
  NetworkParentName?: string;
  NumEmployees?: number;
  NumBeds?: number;
  HospitalType?: string;
  EMRVendorAmbulatory?: string;
  EMRVendorInpatient?: string;
  DHCProfile?: string;
  NumHospitals?: number;
}

export interface DefinitiveSearchParams {
  query: string;
}

export interface DefinitiveEnrichmentResult {
  healthSystem: {
    id: string;
    name: string;
    definitive_id: string;
    website?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    ambulatory_ehr?: string;
    net_patient_revenue?: number;
    number_of_beds?: number;
    number_of_hospitals_in_network?: number;
  };
  success: boolean;
  error?: string;
}

export class DefinitiveService {
  private static instance: DefinitiveService;
  private client: AxiosInstance;

  private constructor() {
    this.client = axios.create({
      baseURL: '/api/definitive',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor for debugging
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        console.warn('Definitive API Response:', {
          url: response.config.url,
          status: response.status,
          data: response.data,
        });
        return response;
      },
      (error: AxiosError) => {
        console.error('Definitive API Error:', {
          url: error.config?.url,
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
        throw error;
      }
    );
  }

  public static getInstance(): DefinitiveService {
    if (!DefinitiveService.instance) {
      DefinitiveService.instance = new DefinitiveService();
    }
    return DefinitiveService.instance;
  }

  /**
   * Search for hospitals in Definitive Healthcare by name
   */
  async searchHospitals(searchParams: DefinitiveSearchParams): Promise<DefinitiveHospitalSearchResult> {
    try {
      // Format the OData filter query
      const filter = `contains(Name, '${searchParams.query}')`;
      
      const response = await this.client.post('', {
        endpoint: 'odata-v4/Hospitals',
        method: 'GET',
        params: {
          '$filter': filter,
          '$top': 20
        }
      });
      
      return response.data || { value: [] };
    } catch (error) {
      console.error('Error searching Definitive hospitals:', error);
      throw error;
    }
  }

  /**
   * Get hospital details by ID
   */
  async getHospital(hospitalId: number): Promise<DefinitiveHospital> {
    try {
      const response = await this.client.post('', {
        endpoint: `odata-v4/Hospitals(${hospitalId})`,
        method: 'GET'
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching Definitive hospital details:', error);
      throw error;
    }
  }

  /**
   * Enrich health systems with data from Definitive Healthcare
   */
  async enrichHealthSystems(healthSystems: any[]): Promise<DefinitiveEnrichmentResult[]> {
    const results: DefinitiveEnrichmentResult[] = [];
    
    for (const system of healthSystems) {
      try {
        // Search for the health system by name
        const searchResult = await this.searchHospitals({ query: system.name });
        
        if (searchResult.value && searchResult.value.length > 0) {
          // Found a match, get the first result
          const match = searchResult.value[0];

          console.log('match', match);
          
          // Return enriched health system data
          results.push({
            healthSystem: {
              id: system.id,
              name: system.name,
              definitive_id: match.Id.toString(),
              website: match.WebSite,
              address: match.Address,
              city: match.HQCity,
              state: match.State,
              zip: match.Zip,
              ambulatory_ehr: match.EMRVendorAmbulatory,
              net_patient_revenue: match.NetPatientRev,
              number_of_beds: match.NumBeds,
              number_of_hospitals_in_network: match.NumHospitals
            },
            success: true
          });
        } else {
          // No match found
          results.push({
            healthSystem: {
              id: system.id,
              name: system.name,
              definitive_id: ''
            },
            success: false,
            error: 'No matching data found'
          });
        }
      } catch (error) {
        // Error occurred
        results.push({
          healthSystem: {
            id: system.id,
            name: system.name,
            definitive_id: ''
          },
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
      }
    }
    
    return results;
  }
}

export const definitiveService = DefinitiveService.getInstance(); 