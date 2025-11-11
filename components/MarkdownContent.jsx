"use client"

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cls } from './utils'

// Fix common markdown issues from AI responses
function fixMarkdown(content) {
  if (!content || typeof content !== 'string') {
    return ''
  }

  let fixed = content
    // First, convert common AI patterns that use single * for emphasis to proper markdown bold
    // Match patterns like "*Label:" or "*Text:" at start of line or after newline
    .replace(/(^|[\n\r])(\*([^*\n]+?):)/gm, '$1**$3:**')
    // Also handle mid-line emphasis markers like "text *Label:" -> "text **Label:**"
    .replace(/(\s)(\*([^*\s][^*\n]{0,50}?):)/g, '$1**$3:**')
    // Fix headers that are missing newlines before them
    .replace(/([^\n])(#{1,6}\s+)/g, '$1\n$2')
    // Fix dash list items that run into text: "text- Item" -> "text\n- Item"
    .replace(/([^\n])([-]\s+)/g, '$1\n$2')
    // Fix numbered lists
    .replace(/([^\n])(\d+\.\s+)/g, '$1\n$2')
    // Normalize excessive newlines
    .replace(/\n{3,}/g, '\n\n')

  return fixed
}

export default function MarkdownContent({ content, className = '' }) {
  // Return empty div if no content
  if (!content || typeof content !== 'string' || !content.trim()) {
    return <div className={cls('markdown-content', className)} />
  }

  // Fix common markdown issues
  const fixedContent = fixMarkdown(content)

  return (
    <div className={cls('markdown-content', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headings
          h1: ({ node, ...props }) => (
            <h1 className="text-2xl font-bold mt-4 mb-2 first:mt-0" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-xl font-bold mt-3 mb-2 first:mt-0" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-lg font-semibold mt-3 mb-1 first:mt-0" {...props} />
          ),
          h4: ({ node, ...props }) => (
            <h4 className="text-base font-semibold mt-2 mb-1 first:mt-0" {...props} />
          ),
          h5: ({ node, ...props }) => (
            <h5 className="text-sm font-semibold mt-2 mb-1 first:mt-0" {...props} />
          ),
          h6: ({ node, ...props }) => (
            <h6 className="text-xs font-semibold mt-2 mb-1 first:mt-0" {...props} />
          ),
          // Paragraphs
          p: ({ node, ...props }) => (
            <p className="mb-2 leading-relaxed [&:last-child]:mb-0" {...props} />
          ),
          // Lists
          ul: ({ node, ...props }) => (
            <ul className="list-disc mb-2 space-y-1 ml-4 pl-2" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal mb-2 space-y-1 ml-4 pl-2" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="leading-relaxed" {...props} />
          ),
          // Code blocks
          code: ({ node, inline, className, children, ...props }) => {
            if (inline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-xs font-mono"
                  {...props}
                >
                  {children}
                </code>
              )
            }
            return (
              <code
                className="block p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-mono overflow-x-auto mb-2"
                {...props}
              >
                {children}
              </code>
            )
          },
          pre: ({ node, ...props }) => (
            <pre className="mb-2 overflow-x-auto" {...props} />
          ),
          // Links
          a: ({ node, ...props }) => (
            <a
              className="text-blue-600 dark:text-blue-400 hover:underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          ),
          // Blockquotes
          blockquote: ({ node, ...props }) => (
            <blockquote
              className="border-l-4 border-zinc-300 dark:border-zinc-600 pl-4 py-1 my-2 italic text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/50 rounded-r"
              {...props}
            />
          ),
          // Horizontal rule
          hr: ({ node, ...props }) => (
            <hr className="my-4 border-zinc-200 dark:border-zinc-700" {...props} />
          ),
          // Tables (from remark-gfm)
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full border border-zinc-200 dark:border-zinc-700 rounded-lg" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead className="bg-zinc-100 dark:bg-zinc-800" {...props} />
          ),
          tbody: ({ node, ...props }) => (
            <tbody {...props} />
          ),
          tr: ({ node, ...props }) => (
            <tr className="border-b border-zinc-200 dark:border-zinc-700" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="px-3 py-2 text-left font-semibold" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="px-3 py-2" {...props} />
          ),
          // Strong (bold)
          strong: ({ node, ...props }) => (
            <strong className="font-semibold" {...props} />
          ),
          // Emphasis (italic)
          em: ({ node, ...props }) => (
            <em className="italic" {...props} />
          ),
          // Strikethrough (from remark-gfm)
          del: ({ node, ...props }) => (
            <del className="line-through opacity-70" {...props} />
          ),
        }}
      >
        {fixedContent}
      </ReactMarkdown>
    </div>
  )
}

