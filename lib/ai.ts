import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { supabaseAdmin } from '@/lib/supabase';

// Interface for the AI enrichment result
export interface AIEnrichmentResult {
  item: any;
  success: boolean;
  enrichedData?: any;
  error?: string;
}

export interface AIEnrichmentRequest {
  items: any[];
  promptTemplate: string;
  columnName: string;
  columnType: string;
  getFieldsForAllColumns?: (item: any) => Array<{ id: string, label: string, value: string, iconName: string }>;
}

/**
 * AI Service
 * This service provides methods for enriching data using AI (GPT-4o-mini-search-preview).
 * 
 * Usage:
 * - enrichItems: Enrich multiple items with AI-generated data based on a prompt template
 * - testPrompt: Test a prompt template on a single item to see what the AI would return
 * 
 * The prompt template can include variables in the format {{variableName}} that will be
 * replaced with the corresponding values from the items being enriched.
 */
export class AIService {
  private static instance: AIService;
  private client: AxiosInstance;

  private constructor() {
    this.client = axios.create({
      baseURL: '/api/ai',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor for debugging
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        console.warn('AI API Response:', {
          url: response.config.url,
          status: response.status,
          data: response.data,
        });
        return response;
      },
      (error: AxiosError) => {
        console.error('AI API Error:', {
          url: error.config?.url,
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
        throw error;
      }
    );
  }

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  /**
   * Enrich items with AI-generated data
   */
  async enrichItems(request: AIEnrichmentRequest): Promise<AIEnrichmentResult[]> {
    try {
      const response = await this.client.post('/enrich', request);
      return response.data.results || [];
    } catch (error) {
      console.error('Error enriching items with AI:', error);
      throw error;
    }
  }

  /**
   * Test a prompt template on a sample item
   */
  async testPrompt(
    item: any, 
    promptTemplate: string, 
    columnName: string, 
    columnType: string, 
    getFieldsForAllColumns?: (item: any) => Array<{ id: string, label: string, value: string, iconName: string }>
  ): Promise<any> {
    try {
      const response = await this.client.post('/test-prompt', {
        item,
        promptTemplate,
        columnName,
        columnType,
        getFieldsForAllColumns
      });
      
      return response.data;
    } catch (error) {
      console.error('Error testing AI prompt:', error);
      throw error;
    }
  }
}

/**
 * Ensure a column exists in the Supabase table
 * This function will check if a column exists, and create it if it doesn't
 */
export async function ensureColumnExists(
  tableName: string, 
  columnName: string, 
  columnType: string
): Promise<boolean> {
  try {    
    // First check if the column already exists using our SQL function
    const { data: columnExists, error: checkError } = await supabaseAdmin.rpc(
      'column_exists',
      { in_column_name: columnName, in_table_name: tableName }
    );
    // If the column already exists, return true
    if (columnExists) {
      return true;
    }

    if (checkError) {
      console.error('Error checking if column exists:', checkError);
      // Instead of throwing, let's try to add the column anyway
      console.log('Proceeding to add column despite check error...');
    }

    // Map the column type to PostgreSQL type
    let pgType: string;
    switch (columnType) {
      case 'boolean':
        pgType = 'boolean';
        break;
      case 'number':
        pgType = 'float8';
        break;
      case 'text':
      default:
        pgType = 'text';
        break;
    }
    
    // Add the column to the table using our SQL function
    const { error: addError } = await supabaseAdmin.rpc(
      'add_column',
      { 
        table_name: tableName, 
        column_name: columnName, 
        column_type: pgType 
      }
    );

    if (addError) {
      console.error('Error adding column to table:', addError);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error ensuring column exists:', error);
    // Return false instead of throwing to allow the process to continue
    return false;
  }
}

export const aiService = AIService.getInstance(); 