import { supabase } from './supabase'

export interface AIPrompt {
  id: string
  name: string
  prompt_template: string
  column_type: 'text' | 'boolean' | 'number'
  description?: string
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface CreateAIPromptData {
  name: string
  prompt_template: string
  column_type: 'text' | 'boolean' | 'number'
  description?: string
  is_default?: boolean
}

export interface UpdateAIPromptData extends Partial<CreateAIPromptData> {
  id: string
}

export const aiPromptsService = {
  // Get all AI prompts
  async getAllPrompts(): Promise<AIPrompt[]> {
    const { data, error } = await supabase
      .from('ai_prompts')
      .select('*')
      .order('is_default', { ascending: false })
      .order('name', { ascending: true })
    
    if (error) {
      console.error('Error fetching AI prompts:', error)
      throw new Error(`Failed to fetch AI prompts: ${error.message}`)
    }
    
    return data || []
  },

  // Get default prompts only
  async getDefaultPrompts(): Promise<AIPrompt[]> {
    const { data, error } = await supabase
      .from('ai_prompts')
      .select('*')
      .eq('is_default', true)
      .order('name', { ascending: true })
    
    if (error) {
      console.error('Error fetching default AI prompts:', error)
      throw new Error(`Failed to fetch default AI prompts: ${error.message}`)
    }
    
    return data || []
  },

  // Get a specific prompt by ID
  async getPromptById(id: string): Promise<AIPrompt | null> {
    const { data, error } = await supabase
      .from('ai_prompts')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null // Not found
      }
      console.error('Error fetching AI prompt:', error)
      throw new Error(`Failed to fetch AI prompt: ${error.message}`)
    }
    
    return data
  },

  // Create a new AI prompt
  async createPrompt(promptData: CreateAIPromptData): Promise<AIPrompt> {
    const { data, error } = await supabase
      .from('ai_prompts')
      .insert(promptData)
      .select()
      .single()
    
    if (error) {
      console.error('Error creating AI prompt:', error)
      throw new Error(`Failed to create AI prompt: ${error.message}`)
    }
    
    return data
  },

  // Update an existing AI prompt
  async updatePrompt(promptData: UpdateAIPromptData): Promise<AIPrompt> {
    const { id, ...updateData } = promptData
    
    const { data, error } = await supabase
      .from('ai_prompts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      console.error('Error updating AI prompt:', error)
      throw new Error(`Failed to update AI prompt: ${error.message}`)
    }
    
    return data
  },

  // Delete an AI prompt
  async deletePrompt(id: string): Promise<void> {
    const { error } = await supabase
      .from('ai_prompts')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('Error deleting AI prompt:', error)
      throw new Error(`Failed to delete AI prompt: ${error.message}`)
    }
  },

  // Check if a prompt name already exists
  async promptNameExists(name: string, excludeId?: string): Promise<boolean> {
    let query = supabase
      .from('ai_prompts')
      .select('id')
      .eq('name', name)
    
    if (excludeId) {
      query = query.neq('id', excludeId)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Error checking prompt name:', error)
      return false
    }
    
    return (data?.length || 0) > 0
  }
} 