import { streamText, convertToCoreMessages } from 'ai'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'

const deepseek = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY,
})

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GEMINI_API_KEY,
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

    const { conversationId, message, model, messages: history } = await req.json()

    if (!conversationId || !message || !model) {
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
      case 'Claude Sonnet 4':
        modelProvider = anthropic
        modelName = 'claude-3-5-sonnet-20241022'
        break
      case 'Gemini':
        modelProvider = google
        modelName = 'gemini-pro'
        break
      default:
        return new Response('Invalid model', { status: 400 })
    }

    // Check API key exists
    if (!process.env.DEEPSEEK_API_KEY && model === 'DeepSeek') {
      return new Response('DeepSeek API key not configured', { status: 500 })
    }
    if (!process.env.ANTHROPIC_API_KEY && model === 'Claude Sonnet 4') {
      return new Response('Anthropic API key not configured', { status: 500 })
    }
    if (!process.env.GOOGLE_GEMINI_API_KEY && model === 'Gemini') {
      return new Response('Google Gemini API key not configured', { status: 500 })
    }

    // Format messages for AI SDK
    const aiMessages = (history || []).map((msg: any) => ({
      role: msg.role,
      content: msg.content,
    }))

    // Add current user message
    aiMessages.push({
      role: 'user',
      content: message,
    })

    // Stream the response
    const result = streamText({
      model: modelProvider(modelName as any),
      messages: aiMessages,
      temperature: 0.7,
      maxTokens: 2000,
    })

    // Check if toDataStreamResponse exists, otherwise use textStream
    if (typeof result.toDataStreamResponse === 'function') {
      return result.toDataStreamResponse()
    }

    // Fallback: create manual streaming response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.textStream) {
            controller.enqueue(encoder.encode(`0:${JSON.stringify({ type: 'text-delta', textDelta: chunk })}\n`))
          }
          controller.enqueue(encoder.encode('d:{"type":"done"}\n'))
          controller.close()
        } catch (error) {
          controller.error(error)
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error: any) {
    console.error('Chat API error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

