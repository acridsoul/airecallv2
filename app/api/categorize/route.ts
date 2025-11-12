import { generateObject } from 'ai'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { 
  getCategories, 
  createCategory, 
  updateConversationCategory 
} from '@/lib/supabase/db'

// Note: Using 'nodejs' runtime to match chat API
export const runtime = 'nodejs'

const deepseek = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY,
})

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GEMINI_API_KEY,
})

// Schema for structured output
const categorySchema = z.object({
  category: z.string().describe('The category name for this conversation (e.g., Programming, Cooking, Medicine, Fashion, Education, Business, Technology, Health, Travel, Sports, Entertainment, Science, Art, Finance, or a new appropriate category name)'),
})

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { conversationId, messages, model } = await req.json()

    if (!conversationId || !messages || !model) {
      return new Response('Missing required fields', { status: 400 })
    }

    // Select the appropriate model provider
    let modelProvider
    let modelName

    switch (model) {
      case 'DeepSeek':
        modelProvider = deepseek
        modelName = 'deepseek-chat'
        break
      case 'Claude Haiku 4.5':
        modelProvider = anthropic
        modelName = 'claude-haiku-4-5-20251001'
        break
      case 'Gemini':
        modelProvider = google
        modelName = 'gemini-2.5-flash'
        break
      default:
        return new Response(`Invalid model: ${model}`, { status: 400 })
    }

    // Check API key exists
    if (model === 'DeepSeek' && !process.env.DEEPSEEK_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'DeepSeek API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
    if (model === 'Claude Haiku 4.5' && !process.env.ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Anthropic API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
    if (model === 'Gemini' && !process.env.GOOGLE_GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Google Gemini API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Extract conversation content (first 3-5 messages for context)
    const messageCount = Math.min(messages.length, 5)
    const conversationContext = messages
      .slice(0, messageCount)
      .map((msg: any) => `${msg.role}: ${msg.content || ''}`)
      .join('\n\n')

    // Create prompt for categorization
    // DeepSeek and Claude Haiku 4.5 require "json" keyword in prompt for structured output
    const needsJsonPrompt = model === 'DeepSeek' || model === 'Claude Haiku 4.5'
    const prompt = needsJsonPrompt
      ? `Analyze this conversation and assign it to ONE category. Return your response as a JSON object.

Consider these common categories: Programming, Cooking, Medicine, Fashion, Education, Business, Technology, Health, Travel, Sports, Entertainment, Science, Art, Finance, Gaming, Music, Literature, History, Philosophy, Psychology, Law, Engineering, Design, Marketing, Finance, Real Estate, Fitness, Nutrition, Parenting, Relationships, Career, Personal Development, Hobbies, DIY, Gardening, Pets, Photography, Writing, Language Learning, Mathematics, Physics, Chemistry, Biology, Astronomy, Geography, Politics, Economics, Religion, Spirituality, or suggest a new appropriate category name if none fit.

Conversation:
${conversationContext}

Return your response in JSON format with the following structure:
{"category": "CategoryName"}

Example JSON output: {"category": "Fashion"}

Return only the category name that best fits this conversation in JSON format.`
      : `Analyze this conversation and assign it to ONE category. 

Consider these common categories: Programming, Cooking, Medicine, Fashion, Education, Business, Technology, Health, Travel, Sports, Entertainment, Science, Art, Finance, Gaming, Music, Literature, History, Philosophy, Psychology, Law, Engineering, Design, Marketing, Finance, Real Estate, Fitness, Nutrition, Parenting, Relationships, Career, Personal Development, Hobbies, DIY, Gardening, Pets, Photography, Writing, Language Learning, Mathematics, Physics, Chemistry, Biology, Astronomy, Geography, Politics, Economics, Religion, Spirituality, or suggest a new appropriate category name if none fit.

Conversation:
${conversationContext}

Return only the category name that best fits this conversation.`

    // Use generateObject for structured output
    const result = await generateObject({
      model: modelProvider(modelName as any),
      prompt,
      schema: categorySchema,
      temperature: 0.3, // Lower temperature for more consistent categorization
    })

    const categoryName = result.object.category.trim()

    if (!categoryName) {
      return new Response(
        JSON.stringify({ error: 'Failed to generate category' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get or create category
    let category
    const existingCategories = await getCategories(user.id)
    const existingCategory = existingCategories.find(
      (c) => c.name.toLowerCase() === categoryName.toLowerCase()
    )

    if (existingCategory) {
      category = existingCategory
    } else {
      // Create new category
      category = await createCategory(user.id, categoryName)
    }

    // Assign conversation to category
    await updateConversationCategory(conversationId, category.id, true)

    return new Response(
      JSON.stringify({
        success: true,
        category: {
          id: category.id,
          name: category.name,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error: any) {
    console.error('Categorization error:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to categorize conversation',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

