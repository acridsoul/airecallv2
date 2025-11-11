"use client"

import { createClient } from './client'
import type { Conversation, Message, Folder, Template } from './db'

// Client-side database functions (for use in components)
const supabase = createClient()

export async function getConversationsClient(userId: string): Promise<Conversation[]> {
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
    updatedAt: conv.updated_at,
    createdAt: conv.created_at,
  }))
}

export async function createConversationClient(
  userId: string,
  title: string = 'New Chat',
  model: string = 'DeepSeek',
  folderId: string | null = null
): Promise<Conversation> {
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
    updatedAt: data.updated_at,
    createdAt: data.created_at,
  }
}

export async function updateConversationClient(
  conversationId: string,
  updates: Partial<Pick<Conversation, 'title' | 'preview' | 'pinned' | 'folder_id' | 'model'>>
): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update(updates)
    .eq('id', conversationId)

  if (error) throw error
}

export async function addMessageClient(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<Message> {
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

  return {
    ...data,
    createdAt: data.created_at,
    edited_at: data.edited_at,
  }
}

export async function updateMessageClient(messageId: string, content: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({
      content,
      edited_at: new Date().toISOString(),
    })
    .eq('id', messageId)

  if (error) throw error
}

export async function getFoldersClient(userId: string): Promise<Folder[]> {
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data || []).map((f: any) => ({
    ...f,
    createdAt: f.created_at,
    updatedAt: f.updated_at,
  }))
}

export async function createFolderClient(userId: string, name: string): Promise<Folder> {
  const { data, error } = await supabase
    .from('folders')
    .insert({
      user_id: userId,
      name,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('Folder already exists')
    }
    throw error
  }

  return {
    ...data,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

export async function updateFolderClient(folderId: string, name: string): Promise<void> {
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

export async function deleteFolderClient(folderId: string): Promise<void> {
  const { error } = await supabase
    .from('folders')
    .delete()
    .eq('id', folderId)

  if (error) throw error
}

export async function getTemplatesClient(userId: string): Promise<Template[]> {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) throw error

  return (data || []).map((t: any) => ({
    ...t,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  }))
}

export async function createTemplateClient(
  userId: string,
  name: string,
  content: string,
  snippet?: string
): Promise<Template> {
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

  return {
    ...data,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

export async function updateTemplateClient(
  templateId: string,
  updates: Partial<Pick<Template, 'name' | 'content' | 'snippet'>>
): Promise<void> {
  const { error } = await supabase
    .from('templates')
    .update(updates)
    .eq('id', templateId)

  if (error) throw error
}

export async function deleteTemplateClient(templateId: string): Promise<void> {
  const { error } = await supabase
    .from('templates')
    .delete()
    .eq('id', templateId)

  if (error) throw error
}

