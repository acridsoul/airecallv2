import { streamText, convertToCoreMessages } from 'ai'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createClient } from '@/lib/supabase/server'

// Note: Changed from 'edge' to 'nodejs' to support PDF parsing with pdf-parse
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

// Helper function to extract text from PDF
async function extractPdfText(dataUrl: string): Promise<string> {
  try {
    // Dynamic import for pdf-parse (CommonJS module)
    // @ts-ignore - pdf-parse has complex export structure
    const pdfParseModule: any = await import('pdf-parse')
    // pdf-parse exports the function directly or as default
    const pdfParse = pdfParseModule.default || pdfParseModule || (pdfParseModule as any).pdfParse
    
    if (typeof pdfParse !== 'function') {
      throw new Error('pdf-parse module not loaded correctly')
    }
    
    // Remove data URL prefix to get base64 data
    const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
    // Convert base64 to buffer
    const pdfBuffer = Buffer.from(base64Data, 'base64')
    // Extract text from PDF
    const data = await pdfParse(pdfBuffer)
    return data.text || ''
  } catch (error: any) {
    console.error('PDF text extraction error:', error)
    return `[PDF text extraction failed: ${error.message || 'Unknown error'}]`
  }
}

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
        modelName = 'claude-sonnet-4-5-20250929'
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
    
    // Check if DeepSeek is being used with image files (not supported)
    if (model === 'DeepSeek' && files && files.length > 0) {
      const hasImages = files.some((f: any) => f.mediaType.startsWith('image/'))
      if (hasImages) {
        return new Response(
          JSON.stringify({ 
            error: `${model} does not support image uploads. However, PDFs are supported via text extraction. Please use Claude Sonnet 4 or Gemini for image processing.` 
          }),
          { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }
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
    const aiMessages = await Promise.all(
      (history || [])
        .filter((msg: any) => {
          // Filter out messages with empty content
          // Allow messages with files even if content is empty
          if (msg.files && msg.files.length > 0) {
            return true
          }
          // Filter out empty or whitespace-only content
          return msg.content && typeof msg.content === 'string' && msg.content.trim().length > 0
        })
        .map(async (msg: any) => {
          try {
            // Handle messages with file attachments
            if (msg.files && msg.files.length > 0) {
              const contentParts: any[] = []
              
              // Add text content if present
              if (msg.content && msg.content.trim()) {
                contentParts.push({ type: 'text', text: msg.content })
              }
              
              // Add file attachments
              for (const file of msg.files) {
                // Skip if file data is not available (might be in history without full data)
                if (!file.data) {
                  // For history messages, just reference the file
                  if (file.filename) {
                    contentParts.push({
                      type: 'text',
                      text: `[File attachment: ${file.filename}]`,
                    })
                  }
                  continue
                }
                
                if (file.mediaType.startsWith('image/')) {
                  contentParts.push({
                    type: 'image',
                    image: file.data,
                  })
                } else if (file.mediaType === 'application/pdf') {
                  // Extract PDF text for models that don't natively support PDFs
                  if (model === 'DeepSeek' || model === 'Claude Sonnet 4') {
                    try {
                      const pdfText = await extractPdfText(file.data)
                      contentParts.push({
                        type: 'text',
                        text: `[PDF Document: ${file.filename}]\n\n${pdfText}`,
                      })
                    } catch (pdfError) {
                      console.error('Error extracting PDF text:', pdfError)
                      contentParts.push({
                        type: 'text',
                        text: `[PDF Document: ${file.filename} - text extraction failed]`,
                      })
                    }
                  } else if (model === 'Gemini') {
                    // Gemini supports PDF files natively - will be handled in current message
                    contentParts.push({
                      type: 'text',
                      text: `[PDF file: ${file.filename}]`,
                    })
                  }
                }
              }
              
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
          } catch (error) {
            console.error('Error processing message:', error)
            // Return a safe fallback message
            return {
              role: msg.role,
              content: msg.content || '[Message processing error]',
            }
          }
        })
    ).then(messages => messages.filter((msg: any) => msg !== null)) // Remove any null messages

    // Build current user message with files if present
    let currentUserMessage: any
    if (files && files.length > 0) {
      const contentParts: any[] = []
      
      // Add text content if present
      if (message && message.trim()) {
        contentParts.push({ type: 'text', text: message })
      }
      
      // Add file attachments
      for (const file of files) {
        if (file.mediaType.startsWith('image/')) {
          // Images work for Claude and Gemini
          if (supportsMultimodal) {
            contentParts.push({
              type: 'image',
              image: file.data,
            })
          }
        } else if (file.mediaType === 'application/pdf') {
          // Handle PDFs based on model capability
          if (model === 'Gemini') {
            // Gemini supports PDF files natively
            try {
              const base64Data = file.data.includes(',') ? file.data.split(',')[1] : file.data
              contentParts.push({
                type: 'file',
                data: base64Data,
                mimeType: 'application/pdf',
              })
            } catch (error) {
              console.error('Error processing PDF for Gemini:', error)
              contentParts.push({
                type: 'text',
                text: `[PDF file: ${file.filename} - processing failed]`,
              })
            }
          } else {
            // For DeepSeek and Claude: Extract text from PDF
            try {
              const pdfText = await extractPdfText(file.data)
              contentParts.push({
                type: 'text',
                text: `[PDF Document: ${file.filename}]\n\n${pdfText}`,
              })
            } catch (error) {
              console.error('Error extracting PDF text:', error)
              contentParts.push({
                type: 'text',
                text: `[PDF Document: ${file.filename} - text extraction failed]`,
              })
            }
          }
        }
      }
      
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
    console.error('Error stack:', error.stack)
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      cause: error.cause,
    })
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

