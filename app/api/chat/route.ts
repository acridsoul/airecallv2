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

    const { conversationId, message, model, messages: history, files } = await req.json()

    if (!conversationId || !model) {
      return new Response('Missing required fields', { status: 400 })
    }

    // Check if message or files are provided
    if (!message && (!files || files.length === 0)) {
      return new Response('Message or files required', { status: 400 })
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
        modelName = 'claude-sonnet-4-20250514'
        break
      case 'Gemini':
        modelProvider = google
        modelName = 'gemini-2.5-flash'
        break
      default:
        return new Response('Invalid model', { status: 400 })
    }

    // Check if model supports multimodal (files/images)
    const supportsMultimodal = model === 'Claude Sonnet 4' || model === 'Gemini'
    if (files && files.length > 0 && !supportsMultimodal) {
      return new Response(
        JSON.stringify({ 
          error: `${model} does not support file uploads. Please use Claude Sonnet 4 or Gemini for file processing.` 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Check API key exists and provide helpful error messages
    if (model === 'DeepSeek' && !process.env.DEEPSEEK_API_KEY) {
      return new Response(
        JSON.stringify({ 
          error: 'DeepSeek API key not configured. Please add DEEPSEEK_API_KEY to your .env.local file.' 
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }
    if (model === 'Claude Sonnet 4' && !process.env.ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ 
          error: 'Anthropic API key not configured. Please add ANTHROPIC_API_KEY to your .env.local file.' 
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }
    if (model === 'Gemini' && !process.env.GOOGLE_GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ 
          error: 'Google Gemini API key not configured. Please add GOOGLE_GEMINI_API_KEY to your .env.local file.' 
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Format messages for AI SDK, filtering out empty messages
    const aiMessages = (history || [])
      .filter((msg: any) => {
        // Filter out messages with empty content
        // Allow messages with files even if content is empty
        if (msg.files && msg.files.length > 0) {
          return true
        }
        // Filter out empty or whitespace-only content
        return msg.content && typeof msg.content === 'string' && msg.content.trim().length > 0
      })
      .map((msg: any) => {
        // Handle messages with file attachments
        if (msg.files && msg.files.length > 0) {
          const contentParts: any[] = []
          
          // Add text content if present
          if (msg.content && msg.content.trim()) {
            contentParts.push({ type: 'text', text: msg.content })
          }
          
          // Add file attachments
          msg.files.forEach((file: any) => {
            if (file.mediaType.startsWith('image/')) {
              contentParts.push({
                type: 'image',
                image: file.data,
              })
            } else if (file.mediaType === 'application/pdf') {
              // For PDFs, we'll include the data URL - models that support PDFs can process them
              contentParts.push({
                type: 'text',
                text: `[PDF file: ${file.filename}]`,
              })
            }
          })
          
          // Ensure we have at least one content part
          if (contentParts.length === 0) {
            return null
          }
          
          return {
            role: msg.role,
            content: contentParts.length === 1 && contentParts[0].type === 'text' 
              ? contentParts[0].text 
              : contentParts,
          }
        }
        
        return {
          role: msg.role,
          content: msg.content,
        }
      })
      .filter((msg: any) => msg !== null) // Remove any null messages

    // Build current user message with files if present
    let currentUserMessage: any
    if (files && files.length > 0 && supportsMultimodal) {
      const contentParts: any[] = []
      
      // Add text content if present
      if (message && message.trim()) {
        contentParts.push({ type: 'text', text: message })
      }
      
      // Add file attachments
      files.forEach((file: any) => {
        if (file.mediaType.startsWith('image/')) {
          // Use the full data URL - Vercel AI SDK accepts data URLs
          contentParts.push({
            type: 'image',
            image: file.data, // data URL format: data:image/png;base64,...
          })
        } else if (file.mediaType === 'application/pdf') {
          // For PDFs with Gemini, we can use file type
          // Extract base64 from data URL for file type
          const base64Data = file.data.includes(',') ? file.data.split(',')[1] : file.data
          if (model === 'Gemini') {
            contentParts.push({
              type: 'file',
              data: base64Data,
              mimeType: 'application/pdf',
            })
          } else {
            // For Claude, PDFs need to be handled differently
            contentParts.push({
              type: 'text',
              text: `[PDF file: ${file.filename} - PDF processing may require additional setup]`,
            })
          }
        }
      })
      
      currentUserMessage = {
        role: 'user',
        content: contentParts.length === 1 && contentParts[0].type === 'text'
          ? contentParts[0].text
          : contentParts,
      }
    } else {
      currentUserMessage = {
        role: 'user',
        content: message || '',
      }
    }
    
    aiMessages.push(currentUserMessage)

    // Stream the response
    try {
      const result = await streamText({
        model: modelProvider(modelName as any),
        messages: aiMessages,
        temperature: 0.7,
      })

      // Use toTextStreamResponse for streaming
      if (typeof result.toTextStreamResponse === 'function') {
        return result.toTextStreamResponse()
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
          } catch (error: any) {
            console.error('Streaming error:', error)
            controller.enqueue(encoder.encode(`e:${JSON.stringify({ type: 'error', error: error.message || 'Streaming error' })}\n`))
            controller.close()
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
    } catch (streamError: any) {
      // Catch errors from streamText initialization
      console.error('StreamText error:', streamError)
      return new Response(
        JSON.stringify({ 
          error: streamError.message || 'Failed to generate response',
          details: streamError.cause || undefined
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
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

