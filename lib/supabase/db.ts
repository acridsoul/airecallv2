import { createClient } from './server'

export interface Conversation {
  id: string
  user_id: string
  title: string
  preview: string
  pinned: boolean
  folder_id: string | null
  category_id: string | null
  auto_categorized: boolean
  model: string
  created_at: string
  updated_at: string
  message_count?: number
  messages?: Message[]
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
  edited_at: string | null
}

export interface Folder {
  id: string
  user_id: string
  name: string
  created_at: string
  updated_at: string
}

export interface Template {
  id: string
  user_id: string
  name: string
  content: string
  snippet: string
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  user_id: string
  name: string
  created_at: string
  updated_at: string
}

// Conversations
export async function getConversations(userId: string): Promise<Conversation[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      *,
      messages (
        id,
        role,
        content,
        created_at,
        edited_at
      )
    `)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) throw error

  return (data || []).map((conv: any) => ({
    ...conv,
    messages: conv.messages || [],
    message_count: conv.messages?.length || 0,
  }))
}

export async function getConversation(conversationId: string, userId: string): Promise<Conversation | null> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      *,
      messages (
        id,
        role,
        content,
        created_at,
        edited_at
      )
    `)
    .eq('id', conversationId)
    .eq('user_id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }

  return {
    ...data,
    messages: data.messages || [],
    message_count: data.messages?.length || 0,
  }
}

export async function createConversation(
  userId: string,
  title: string = 'New Chat',
  model: string = 'DeepSeek',
  folderId: string | null = null
): Promise<Conversation> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      user_id: userId,
      title,
      preview: 'Say hello to start...',
      model,
      folder_id: folderId,
    })
    .select()
    .single()

  if (error) throw error

  return {
    ...data,
    messages: [],
    message_count: 0,
  }
}

export async function updateConversation(
  conversationId: string,
  updates: Partial<Pick<Conversation, 'title' | 'preview' | 'pinned' | 'folder_id' | 'model' | 'category_id' | 'auto_categorized'>>
): Promise<void> {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('conversations')
    .update(updates)
    .eq('id', conversationId)

  if (error) throw error
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId)

  if (error) throw error
}

// Messages
export async function addMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<Message> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      role,
      content,
    })
    .select()
    .single()

  if (error) throw error

  // Update conversation updated_at and preview
  const preview = content.slice(0, 80)
  await supabase
    .from('conversations')
    .update({ 
      updated_at: new Date().toISOString(),
      preview,
    })
    .eq('id', conversationId)

  return data
}

export async function updateMessage(messageId: string, content: string): Promise<void> {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('messages')
    .update({
      content,
      edited_at: new Date().toISOString(),
    })
    .eq('id', messageId)

  if (error) throw error
}

export async function deleteMessage(messageId: string): Promise<void> {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('id', messageId)

  if (error) throw error
}

// Folders
export async function getFolders(userId: string): Promise<Folder[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return data || []
}

export async function createFolder(userId: string, name: string): Promise<Folder> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('folders')
    .insert({
      user_id: userId,
      name,
    })
    .select()
    .single()

  if (error) {
    // Handle unique constraint violation
    if (error.code === '23505') {
      throw new Error('Folder already exists')
    }
    throw error
  }

  return data
}

export async function updateFolder(folderId: string, name: string): Promise<void> {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('folders')
    .update({ name })
    .eq('id', folderId)

  if (error) {
    if (error.code === '23505') {
      throw new Error('Folder name already exists')
    }
    throw error
  }
}

export async function deleteFolder(folderId: string): Promise<void> {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('folders')
    .delete()
    .eq('id', folderId)

  if (error) throw error
}

// Templates
export async function getTemplates(userId: string): Promise<Template[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) throw error

  return data || []
}

export async function createTemplate(
  userId: string,
  name: string,
  content: string,
  snippet?: string
): Promise<Template> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('templates')
    .insert({
      user_id: userId,
      name,
      content,
      snippet: snippet || content.slice(0, 100),
    })
    .select()
    .single()

  if (error) throw error

  return data
}

export async function updateTemplate(
  templateId: string,
  updates: Partial<Pick<Template, 'name' | 'content' | 'snippet'>>
): Promise<void> {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('templates')
    .update(updates)
    .eq('id', templateId)

  if (error) throw error
}

export async function deleteTemplate(templateId: string): Promise<void> {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('templates')
    .delete()
    .eq('id', templateId)

  if (error) throw error
}

// Categories
export async function getCategories(userId: string): Promise<Category[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true })

  if (error) throw error

  return data || []
}

export async function createCategory(userId: string, name: string): Promise<Category> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('categories')
    .insert({
      user_id: userId,
      name,
    })
    .select()
    .single()

  if (error) {
    // Handle unique constraint violation
    if (error.code === '23505') {
      throw new Error('Category already exists')
    }
    throw error
  }

  return data
}

export async function updateCategory(categoryId: string, name: string): Promise<void> {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('categories')
    .update({ name })
    .eq('id', categoryId)

  if (error) {
    if (error.code === '23505') {
      throw new Error('Category name already exists')
    }
    throw error
  }
}

export async function deleteCategory(categoryId: string): Promise<void> {
  const supabase = await createClient()
  
  // First, set all conversations with this category to null
  await supabase
    .from('conversations')
    .update({ category_id: null })
    .eq('category_id', categoryId)
  
  // Then delete the category
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', categoryId)

  if (error) throw error
}

export async function updateConversationCategory(
  conversationId: string,
  categoryId: string | null,
  autoCategorized: boolean = false
): Promise<void> {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('conversations')
    .update({
      category_id: categoryId,
      auto_categorized: autoCategorized,
    })
    .eq('id', conversationId)

  if (error) throw error
}

