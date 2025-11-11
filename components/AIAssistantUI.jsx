"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { Calendar, LayoutGrid, MoreHorizontal } from "lucide-react"
import Sidebar from "./Sidebar"
import Header from "./Header"
import ChatPane from "./ChatPane"
import GhostIconButton from "./GhostIconButton"
import ThemeToggle from "./ThemeToggle"
import { useAuth } from "@/contexts/AuthContext"
import { 
  getConversationsClient, 
  createConversationClient, 
  updateConversationClient,
  addMessageClient,
  updateMessageClient,
  getFoldersClient,
  createFolderClient,
  updateFolderClient,
  deleteFolderClient,
  getTemplatesClient,
  createTemplateClient,
  updateTemplateClient,
  deleteTemplateClient
} from "@/lib/supabase/db-client"

export default function AIAssistantUI() {
  const { loading: authLoading, user } = useAuth()

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-sm dark:from-zinc-200 dark:to-zinc-300 dark:text-zinc-900 mb-4">
            <span className="text-xl">✱</span>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading...</p>
        </div>
      </div>
    )
  }
  const [theme, setTheme] = useState(() => {
    const saved = typeof window !== "undefined" && localStorage.getItem("theme")
    if (saved) return saved
    if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches)
      return "dark"
    return "light"
  })

  useEffect(() => {
    try {
      if (theme === "dark") document.documentElement.classList.add("dark")
      else document.documentElement.classList.remove("dark")
      document.documentElement.setAttribute("data-theme", theme)
      document.documentElement.style.colorScheme = theme
      localStorage.setItem("theme", theme)
    } catch {}
  }, [theme])

  useEffect(() => {
    try {
      const media = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)")
      if (!media) return
      const listener = (e) => {
        const saved = localStorage.getItem("theme")
        if (!saved) setTheme(e.matches ? "dark" : "light")
      }
      media.addEventListener("change", listener)
      return () => media.removeEventListener("change", listener)
    } catch {}
  }, [])

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const raw = localStorage.getItem("sidebar-collapsed")
      return raw ? JSON.parse(raw) : { pinned: true, recent: false, folders: true, templates: true }
    } catch {
      return { pinned: true, recent: false, folders: true, templates: true }
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem("sidebar-collapsed", JSON.stringify(collapsed))
    } catch {}
  }, [collapsed])

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem("sidebar-collapsed-state")
      return saved ? JSON.parse(saved) : false
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem("sidebar-collapsed-state", JSON.stringify(sidebarCollapsed))
    } catch {}
  }, [sidebarCollapsed])

  const [conversations, setConversations] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [templates, setTemplates] = useState([])
  const [folders, setFolders] = useState([])
  const [selectedModel, setSelectedModel] = useState("DeepSeek")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [query, setQuery] = useState("")
  const searchRef = useRef(null)

  const [isThinking, setIsThinking] = useState(false)
  const [thinkingConvId, setThinkingConvId] = useState(null)
  const [streamingMessageId, setStreamingMessageId] = useState(null)

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault()
        createNewChat()
      }
      if (!e.metaKey && !e.ctrlKey && e.key === "/") {
        const tag = document.activeElement?.tagName?.toLowerCase()
        if (tag !== "input" && tag !== "textarea") {
          e.preventDefault()
          searchRef.current?.focus()
        }
      }
      if (e.key === "Escape" && sidebarOpen) setSidebarOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [sidebarOpen, conversations])

  // Load data from database on mount
  useEffect(() => {
    if (!user || authLoading) return

    async function loadData() {
      try {
        setLoading(true)
        setError(null)
        const [convs, folds, temps] = await Promise.all([
          getConversationsClient(user.id),
          getFoldersClient(user.id),
          getTemplatesClient(user.id),
        ])
        
        setConversations(convs)
        setFolders(folds)
        setTemplates(temps)
        
        // Select first conversation or create new one
        if (convs.length > 0 && !selectedId) {
          setSelectedId(convs[0].id)
        } else if (convs.length === 0) {
          // Auto-create first chat if none exist
          const newConv = await createConversationClient(user.id, "New Chat", selectedModel)
          setConversations([newConv])
          setSelectedId(newConv.id)
        }
      } catch (err) {
        console.error('Error loading data:', err)
        setError(err.message || 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [user, authLoading])

  useEffect(() => {
    if (!selectedId && conversations.length > 0) {
      setSelectedId(conversations[0].id)
    }
  }, [conversations])

  // Sync selectedModel with conversation's model when switching conversations
  useEffect(() => {
    if (selectedId && conversations.length > 0) {
      const conv = conversations.find((c) => c.id === selectedId)
      if (conv?.model) {
        setSelectedModel(conv.model)
      } else {
        // Default to DeepSeek if conversation has no model set
        setSelectedModel('DeepSeek')
      }
    }
  }, [selectedId, conversations])

  const filtered = useMemo(() => {
    if (!query.trim()) return conversations
    const q = query.toLowerCase()
    return conversations.filter((c) => c.title.toLowerCase().includes(q) || c.preview.toLowerCase().includes(q))
  }, [conversations, query])

  const pinned = filtered.filter((c) => c.pinned).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))

  const recent = filtered
    .filter((c) => !c.pinned)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .slice(0, 10)

  const folderCounts = React.useMemo(() => {
    const map = Object.fromEntries(folders.map((f) => [f.id, 0]))
    for (const c of conversations) {
      if (c.folder_id && map[c.folder_id] != null) {
        map[c.folder_id] += 1
      }
    }
    return map
  }, [conversations, folders])

  async function togglePin(id) {
    const conv = conversations.find((c) => c.id === id)
    if (!conv) return
    
    try {
      await updateConversationClient(id, { pinned: !conv.pinned })
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)))
    } catch (err) {
      console.error('Error toggling pin:', err)
      setError(err.message || 'Failed to update conversation')
    }
  }

  async function createNewChat() {
    if (!user) return
    
    try {
      const newConv = await createConversationClient(user.id, "New Chat", selectedModel)
      setConversations((prev) => [newConv, ...prev])
      setSelectedId(newConv.id)
      setSidebarOpen(false)
    } catch (err) {
      console.error('Error creating conversation:', err)
      setError(err.message || 'Failed to create conversation')
    }
  }

  async function createFolder() {
    if (!user) return
    
    const name = prompt("Folder name")
    if (!name) return
    
    try {
      const newFolder = await createFolderClient(user.id, name)
      setFolders((prev) => [...prev, newFolder])
    } catch (err) {
      alert(err.message || 'Failed to create folder')
    }
  }

  async function sendMessage(convId, content, files = []) {
    if ((!content || !content.trim()) && (!files || files.length === 0) || !user) return
    
    const conversation = conversations.find((c) => c.id === convId)
    if (!conversation) return

    try {
      // Save user message to database (files will be stored in content or separate field)
      const userMsg = await addMessageClient(convId, 'user', content || '')
      
      // Add files to user message if present
      const userMsgWithFiles = files.length > 0 
        ? { ...userMsg, files }
        : userMsg

      // Update UI optimistically
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== convId) return c
          const msgs = [...(c.messages || []), userMsgWithFiles]
          return {
            ...c,
            messages: msgs,
            messageCount: msgs.length,
            preview: (content || '').slice(0, 80) || (files.length > 0 ? `📎 ${files.length} file(s)` : ''),
          }
        }),
      )

      // Generate title from first message if it's still "New Chat"
      if (conversation.title === "New Chat" && conversation.messages?.length === 0) {
        const title = (content || '').slice(0, 50) + ((content || '').length > 50 ? '...' : '') || 
                      (files.length > 0 ? `📎 ${files.length} file(s)` : 'New Chat')
        await updateConversationClient(convId, { title })
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, title } : c))
        )
      }

      setIsThinking(true)
      setThinkingConvId(convId)

      // Create assistant message placeholder
      const assistantMsgId = Math.random().toString(36).slice(2)
      const assistantMsg = {
        id: assistantMsgId,
        conversation_id: convId,
        role: 'assistant',
        content: '',
        created_at: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        edited_at: null,
      }

      setStreamingMessageId(assistantMsgId)
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== convId) return c
          return {
            ...c,
            messages: [...(c.messages || []), assistantMsg],
          }
        }),
      )

      // Get conversation messages BEFORE adding the placeholder assistant message
      // This ensures we don't include the empty placeholder in the API request
      const conversationBeforePlaceholder = conversations.find((c) => c.id === convId)
      const messagesToSend = (conversationBeforePlaceholder?.messages || [])
        .filter((m) => {
          // Filter out empty assistant messages (placeholders)
          if (m.role === 'assistant' && (!m.content || !m.content.trim())) {
            return false
          }
          // Include messages with content or files
          return (m.content && m.content.trim()) || (m.files && m.files.length > 0)
        })
        .map((m) => ({
          role: m.role,
          content: m.content || '',
          files: m.files || undefined,
        }))

      // Call streaming API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: convId,
          message: content || '',
          model: conversation.model || selectedModel,
          files: files.length > 0 ? files : undefined,
          messages: messagesToSend,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }))
        throw new Error(errorData.error || `API error: ${response.statusText}`)
      }

      // Check if response is JSON (error) or stream
      const contentType = response.headers.get('content-type')
      if (contentType?.includes('application/json')) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Unknown API error')
      }

      // Handle streaming response
      let fullContent = ''
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error('No response body')

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter((line) => line.trim())

        for (const line of lines) {
          // Handle Vercel AI SDK data stream format: 0:{"type":"text-delta","textDelta":"..."}
          if (line.startsWith('0:')) {
            try {
              const data = JSON.parse(line.slice(2))
              if (data.type === 'text-delta' && data.textDelta) {
                fullContent += data.textDelta
                // Update UI in real-time
                setConversations((prev) =>
                  prev.map((c) => {
                    if (c.id !== convId) return c
                    return {
                      ...c,
                      messages: c.messages?.map((m) =>
                        m.id === assistantMsgId
                          ? { ...m, content: fullContent }
                          : m
                      ) || [],
                    }
                  }),
                )
              } else if (data.type === 'error') {
                throw new Error(data.error || 'Unknown error occurred')
              }
            } catch (e) {
              // If it's an error object, throw it
              if (e && e.message && e.message !== 'Unexpected token' && !e.message.includes('JSON')) {
                throw e
              }
              // Otherwise ignore parse errors for malformed chunks
            }
          } 
          // Handle data chunks: d:{"type":"text-delta","textDelta":"..."}
          else if (line.startsWith('d:')) {
            try {
              const data = JSON.parse(line.slice(2))
              if (data.type === 'text-delta' && data.textDelta) {
                fullContent += data.textDelta
                setConversations((prev) =>
                  prev.map((c) => {
                    if (c.id !== convId) return c
                    return {
                      ...c,
                      messages: c.messages?.map((m) =>
                        m.id === assistantMsgId
                          ? { ...m, content: fullContent }
                          : m
                      ) || [],
                    }
                  }),
                )
              } else if (data.type === 'error') {
                throw new Error(data.error || 'Unknown error occurred')
              } else if (data.type === 'done') {
                // Stream completed
                break
              }
            } catch (e) {
              // If it's an error object, throw it
              if (e && e.message && e.message !== 'Unexpected token' && !e.message.includes('JSON')) {
                throw e
              }
              // Otherwise ignore parse errors
            }
          } 
          // Handle error chunks: e:{"type":"error","error":"..."}
          else if (line.startsWith('e:')) {
            try {
              const data = JSON.parse(line.slice(2))
              throw new Error(data.error || 'Streaming error occurred')
            } catch (e) {
              throw (e && e.message) ? e : new Error('Unknown streaming error')
            }
          }
          // Handle plain text chunks (fallback for some formats)
          else if (line.trim() && !line.startsWith('0:') && !line.startsWith('d:') && !line.startsWith('e:')) {
            // Try to parse as JSON, if not, treat as plain text
            try {
              const data = JSON.parse(line)
              if (data.type === 'text-delta' && data.textDelta) {
                fullContent += data.textDelta
                setConversations((prev) =>
                  prev.map((c) => {
                    if (c.id !== convId) return c
                    return {
                      ...c,
                      messages: c.messages?.map((m) =>
                        m.id === assistantMsgId
                          ? { ...m, content: fullContent }
                          : m
                      ) || [],
                    }
                  }),
                )
              }
            } catch (e) {
              // Not JSON, might be plain text - add it
              if (line.trim()) {
                fullContent += line
                setConversations((prev) =>
                  prev.map((c) => {
                    if (c.id !== convId) return c
                    return {
                      ...c,
                      messages: c.messages?.map((m) =>
                        m.id === assistantMsgId
                          ? { ...m, content: fullContent }
                          : m
                      ) || [],
                    }
                  }),
                )
              }
            }
          }
        }
      }

      // Save complete message to database only if we have content
      if (fullContent && fullContent.trim()) {
        await addMessageClient(convId, 'assistant', fullContent)
      } else {
        // If no content was received, remove the placeholder assistant message
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== convId) return c
            return {
              ...c,
              messages: c.messages?.filter((m) => m.id !== assistantMsgId) || [],
            }
          }),
        )
      }
      
      setIsThinking(false)
      setThinkingConvId(null)
      setStreamingMessageId(null)
    } catch (err) {
      console.error('Error sending message:', err)
      setError(err.message || 'Failed to send message')
      setIsThinking(false)
      setThinkingConvId(null)
      setStreamingMessageId(null)
      
      // Remove failed assistant message
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== convId) return c
          return {
            ...c,
            messages: c.messages?.filter((m) => m.id !== streamingMessageId) || [],
          }
        }),
      )
    }
  }

  async function editMessage(convId, messageId, newContent) {
    try {
      await updateMessageClient(messageId, newContent)
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== convId) return c
          const msgs = (c.messages || []).map((m) =>
            m.id === messageId 
              ? { ...m, content: newContent, edited_at: new Date().toISOString(), editedAt: new Date().toISOString() }
              : m,
          )
          return {
            ...c,
            messages: msgs,
            preview: msgs[msgs.length - 1]?.content?.slice(0, 80) || c.preview,
          }
        }),
      )
    } catch (err) {
      console.error('Error editing message:', err)
      setError(err.message || 'Failed to edit message')
    }
  }

  function resendMessage(convId, messageId) {
    const conv = conversations.find((c) => c.id === convId)
    const msg = conv?.messages?.find((m) => m.id === messageId)
    if (!msg) return
    sendMessage(convId, msg.content)
  }

  function pauseThinking() {
    setIsThinking(false)
    setThinkingConvId(null)
  }

  async function handleDeleteFolder(folderId) {
    try {
      await deleteFolderClient(folderId)
      setFolders((prev) => prev.filter((f) => f.id !== folderId))
      // Remove folder from conversations
      setConversations((prev) =>
        prev.map((c) => (c.folder_id === folderId ? { ...c, folder_id: null } : c))
      )
    } catch (err) {
      console.error('Error deleting folder:', err)
      alert(err.message || 'Failed to delete folder')
    }
  }

  async function handleRenameFolder(folderId, newName) {
    try {
      await updateFolderClient(folderId, newName)
      setFolders((prev) =>
        prev.map((f) => (f.id === folderId ? { ...f, name: newName } : f))
      )
    } catch (err) {
      console.error('Error renaming folder:', err)
      alert(err.message || 'Failed to rename folder')
    }
  }

  async function handleCreateTemplate(templateData) {
    if (!user) return
    
    try {
      const newTemplate = await createTemplateClient(
        user.id,
        templateData.name,
        templateData.content,
        templateData.snippet
      )
      setTemplates((prev) => [...prev, newTemplate])
    } catch (err) {
      console.error('Error creating template:', err)
      alert(err.message || 'Failed to create template')
    }
  }

  async function handleUpdateTemplate(templateId, updates) {
    try {
      await updateTemplateClient(templateId, updates)
      setTemplates((prev) =>
        prev.map((t) => (t.id === templateId ? { ...t, ...updates } : t))
      )
    } catch (err) {
      console.error('Error updating template:', err)
      alert(err.message || 'Failed to update template')
    }
  }

  async function handleDeleteTemplate(templateId) {
    try {
      await deleteTemplateClient(templateId)
      setTemplates((prev) => prev.filter((t) => t.id !== templateId))
    } catch (err) {
      console.error('Error deleting template:', err)
      alert(err.message || 'Failed to delete template')
    }
  }

  function handleUseTemplate(template) {
    if (composerRef.current) {
      composerRef.current.insertTemplate(template.content)
    }
  }

  function handleModelChange(model) {
    setSelectedModel(model)
    // Update current conversation's model if it exists
    if (selectedId) {
      updateConversationClient(selectedId, { model }).catch(console.error)
      setConversations((prev) =>
        prev.map((c) => (c.id === selectedId ? { ...c, model } : c))
      )
    }
  }

  const composerRef = useRef(null)

  const selected = conversations.find((c) => c.id === selectedId) || null

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-sm dark:from-zinc-200 dark:to-zinc-300 dark:text-zinc-900 mb-4">
            <span className="text-xl">✱</span>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading your conversations...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-red-500 text-white shadow-sm mb-4">
            <span className="text-xl">⚠</span>
          </div>
          <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-white dark:text-zinc-900"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-full bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="md:hidden sticky top-0 z-40 flex items-center gap-2 border-b border-zinc-200/60 bg-white/80 px-3 py-2 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="ml-1 flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span className="inline-flex h-4 w-4 items-center justify-center">✱</span> AI Assistant
        </div>
        <div className="ml-auto flex items-center gap-2">
          <GhostIconButton label="Schedule">
            <Calendar className="h-4 w-4" />
          </GhostIconButton>
          <GhostIconButton label="Apps">
            <LayoutGrid className="h-4 w-4" />
          </GhostIconButton>
          <GhostIconButton label="More">
            <MoreHorizontal className="h-4 w-4" />
          </GhostIconButton>
          <ThemeToggle theme={theme} setTheme={setTheme} />
        </div>
      </div>

      <div className="flex h-[calc(100vh-0px)]">
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          theme={theme}
          setTheme={setTheme}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          conversations={conversations}
          pinned={pinned}
          recent={recent}
          folders={folders}
          folderCounts={folderCounts}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(id)}
          togglePin={togglePin}
          query={query}
          setQuery={setQuery}
          searchRef={searchRef}
          createFolder={createFolder}
          createNewChat={createNewChat}
          templates={templates}
          setTemplates={setTemplates}
          onUseTemplate={handleUseTemplate}
          onDeleteFolder={handleDeleteFolder}
          onRenameFolder={handleRenameFolder}
          onCreateTemplate={handleCreateTemplate}
          onUpdateTemplate={handleUpdateTemplate}
          onDeleteTemplate={handleDeleteTemplate}
        />

        <main className="relative flex min-w-0 flex-1 flex-col">
          <Header 
            createNewChat={createNewChat} 
            sidebarCollapsed={sidebarCollapsed} 
            setSidebarOpen={setSidebarOpen}
            selectedModel={selectedModel}
            onModelChange={handleModelChange}
          />
          <ChatPane
            ref={composerRef}
            conversation={selected}
            onSend={(content, files) => selected && sendMessage(selected.id, content, files)}
            onEditMessage={(messageId, newContent) => selected && editMessage(selected.id, messageId, newContent)}
            onResendMessage={(messageId) => selected && resendMessage(selected.id, messageId)}
            isThinking={isThinking && thinkingConvId === selected?.id}
            onPauseThinking={pauseThinking}
          />
        </main>
      </div>
    </div>
  )
}

