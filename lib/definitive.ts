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
  confidence?: number;
  alternativeMatches?: Array<{
    name: string;
    id: number;
    confidence: number;
  }>;
}

// Interface for health system cache
export interface HealthSystemCache {
  timestamp: number;
  systems: DefinitiveHospital[];
}

export class DefinitiveService {
  private static instance: DefinitiveService;
  private client: AxiosInstance;
  private healthSystemsCache: HealthSystemCache | null = null;
  private readonly CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

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
   * Fetch all health systems from Definitive Healthcare
   * Uses caching to avoid excessive API calls
   */
  async getAllHealthSystems(): Promise<DefinitiveHospital[]> {
    try {
      // Check if we have a valid cache
      const now = Date.now();
      if (this.healthSystemsCache && 
          (now - this.healthSystemsCache.timestamp < this.CACHE_DURATION_MS)) {
        console.log('Using cached health systems data');
        return this.healthSystemsCache.systems;
      }

      console.log('Fetching all health systems from Definitive');
      
      // Fetch health systems - adjust the filter as needed based on API capabilities
      const response = await this.client.post('', {
        endpoint: 'odata-v4/Hospitals',
        method: 'GET',
        params: {
          '$top': 7000, // Adjust based on API limits
          '$orderby': 'Name asc'
        }
      });

      if (response.data?.value) {
        console.log('Fetched health systems:', response.data.value.length);
        // Update cache
        this.healthSystemsCache = {
          timestamp: now,
          systems: response.data.value
        };
        return response.data.value;
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching all health systems:', error);
      
      // If cache exists but is expired, still use it in case of error
      if (this.healthSystemsCache) {
        console.log('Using expired cache due to fetch error');
        return this.healthSystemsCache.systems;
      }
      
      return [];
    }
  }

  /**
   * Calculate string similarity score using Levenshtein distance
   * Returns a value between 0 (no match) and 1 (perfect match)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    // Normalize strings for comparison
    const a = str1.toLowerCase().trim();
    const b = str2.toLowerCase().trim();
    
    // If either string is empty, return 0
    if (a.length === 0 || b.length === 0) return 0;
    
    // If strings are identical, return 1
    if (a === b) return 1;
    
    // Initialize the distance matrix
    const matrix: number[][] = [];
    for (let i = 0; i <= a.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= b.length; j++) {
      matrix[0][j] = j;
    }
    
    // Fill the distance matrix
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }
    
    // Convert edit distance to similarity score
    const maxLength = Math.max(a.length, b.length);
    const distance = matrix[a.length][b.length];
    return (maxLength - distance) / maxLength;
  }

  /**
   * Search for hospitals in Definitive Healthcare by name
   */
  async searchHospitals(searchParams: DefinitiveSearchParams): Promise<DefinitiveHospitalSearchResult> {
    try {
      // First, try to sanitize the input to make it more OData-friendly
      const sanitizeInput = (input: string): string => {
        // Remove any characters that might cause issues with OData
        return input.replace(/[^\w\s.-]/g, '').trim();
      };

      // Start with the original query
      let safeQuery = searchParams.query.trim();
      let searchTerms = safeQuery.split(/\s+/).filter(term => term.length > 1);
      
      // If no valid search terms, use a sanitized version
      if (searchTerms.length === 0) {
        safeQuery = sanitizeInput(safeQuery);
        searchTerms = [safeQuery];
      }

      // Handle the searches with multiple fallback approaches
      try {
        // APPROACH 1: Try a sanitized search (most likely to succeed)
        // Remove special characters entirely for a simple search
        const sanitizedQuery = sanitizeInput(safeQuery);
        
        if (sanitizedQuery.length > 0) {
          console.log('Trying sanitized search:', sanitizedQuery);
          
          try {
            const sanitizedResponse = await this.client.post('', {
              endpoint: 'odata-v4/Hospitals',
              method: 'GET',
              params: {
                '$filter': `contains(Name, '${sanitizedQuery}')`,
                '$top': 20,
                '$orderby': 'Name asc'
              }
            });
            
            if (sanitizedResponse.data?.value?.length > 0) {
              return sanitizedResponse.data;
            }
          } catch (error) {
            console.warn('Sanitized search failed, trying alternatives');
          }
        }
        
        // If all else fails, return empty results
        return { value: [] };
        
      } catch (searchError) {
        console.error('All search approaches failed:', searchError);
        return { value: [] };
      }
    } catch (error) {
      console.error('Error searching Definitive hospitals:', error);
      return { value: [] }; // Return empty results instead of throwing
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
   * Find best matching health system using fuzzy matching
   * Returns the best match and alternatives with confidence scores
   */
  private async findBestMatch(searchName: string): Promise<{
    bestMatch: DefinitiveHospital | null,
    confidence: number,
    alternatives: Array<{hospital: DefinitiveHospital, confidence: number}>
  }> {
    // Fetch all health systems
    const allSystems = await this.getAllHealthSystems();
    
    if (allSystems.length === 0) {
      // Fallback to regular search if we couldn't get all systems
      const searchResult = await this.searchHospitals({ query: searchName });
      if (searchResult.value && searchResult.value.length > 0) {
        return {
          bestMatch: searchResult.value[0],
          confidence: 0.8, // Arbitrary confidence for API search results
          alternatives: searchResult.value.slice(1, 4).map(h => ({ 
            hospital: h, 
            confidence: 0.7 
          }))
        };
      }
      return { bestMatch: null, confidence: 0, alternatives: [] };
    }
    
    // Calculate similarity scores for all health systems
    const matches = allSystems.map(system => {
      // Calculate similarity between search name and system name
      const similarity = this.calculateSimilarity(searchName, system.Name);
      
      // Potentially give more weight to exact substring matches
      const containsName = system.Name.toLowerCase().includes(searchName.toLowerCase());
      const isContainedIn = searchName.toLowerCase().includes(system.Name.toLowerCase());
      
      // Boost score for substring matches
      let adjustedScore = similarity;
      if (containsName) adjustedScore += 0.1;
      if (isContainedIn) adjustedScore += 0.05;
      
      // Cap at 1.0
      const finalScore = Math.min(adjustedScore, 1.0);
      
      return {
        hospital: system,
        confidence: finalScore
      };
    });
    
    // Sort by confidence score (descending)
    matches.sort((a, b) => b.confidence - a.confidence);
    
    // Get best match and alternatives
    const bestMatch = matches.length > 0 ? matches[0].hospital : null;
    const confidence = matches.length > 0 ? matches[0].confidence : 0;
    
    // Return top alternatives (skip the best match)
    const alternatives = matches.slice(1, 4);
    
    return { bestMatch, confidence, alternatives };
  }

  /**
   * Enrich health systems with data from Definitive Healthcare
   * Uses fuzzy matching to find the best matches
   */
  async enrichHealthSystems(healthSystems: any[]): Promise<DefinitiveEnrichmentResult[]> {
    const results: DefinitiveEnrichmentResult[] = [];
    
    for (const system of healthSystems) {
      try {
        // Find best match using fuzzy search
        const { bestMatch, confidence, alternatives } = await this.findBestMatch(system.name);
        // TODO: this needs to be tuned further - right now the matches aren't great
        console.log('bestMatch', bestMatch);
        console.log('confidence', confidence);
        console.log('alternatives', alternatives);
        
        if (bestMatch && confidence > 0.4) { // Threshold for acceptable matches
          console.log(`Match found for "${system.name}": "${bestMatch.Name}" (confidence: ${confidence.toFixed(2)})`);
          
          // Return enriched health system data with match quality info
          results.push({
            healthSystem: {
              id: system.id,
              name: system.name,
              definitive_id: bestMatch.Id.toString(),
              website: bestMatch.WebSite,
              address: bestMatch.Address,
              city: bestMatch.HQCity,
              state: bestMatch.State,
              zip: bestMatch.Zip,
              ambulatory_ehr: bestMatch.EMRVendorAmbulatory,
              net_patient_revenue: bestMatch.NetPatientRev,
              number_of_beds: bestMatch.NumBeds,
              number_of_hospitals_in_network: bestMatch.NumHospitals || 1
            },
            success: true,
            confidence: confidence,
            alternativeMatches: alternatives.map(alt => ({
              name: alt.hospital.Name,
              id: alt.hospital.Id,
              confidence: alt.confidence
            }))
          });
        } else {
          // No good match found - try direct API search as fallback
          const searchResult = await this.searchHospitals({ query: system.name });
          
          if (searchResult.value && searchResult.value.length > 0) {
            // Found a match through direct API search
            const match = searchResult.value[0];
            console.log(`API search match for "${system.name}": "${match.Name}"`);
            
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
                number_of_hospitals_in_network: match.NumHospitals || 1
              },
              success: true,
              confidence: 0.6, // Arbitrary confidence for API search results
              alternativeMatches: searchResult.value.slice(1, 4).map(h => ({
                name: h.Name,
                id: h.Id,
                confidence: 0.5
              }))
            });
          } else {
            // No match found at all
            console.log(`No match found for "${system.name}"`);
            results.push({
              healthSystem: {
                id: system.id,
                name: system.name,
                definitive_id: ''
              },
              success: false,
              error: 'No matching data found',
              confidence: 0,
              alternativeMatches: alternatives.slice(0, 3).map(alt => ({
                name: alt.hospital.Name,
                id: alt.hospital.Id,
                confidence: alt.confidence
              }))
            });
          }
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