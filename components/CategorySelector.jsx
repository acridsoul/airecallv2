"use client"

import { useState, useEffect, useRef } from "react"
import { ChevronDown, Plus, Tag } from "lucide-react"
import { cls } from "./utils"
import { createCategoryClient } from "@/lib/supabase/db-client"

export default function CategorySelector({
  conversationId,
  currentCategoryId,
  categories = [],
  onCategoryChange,
  userId,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false)
  const dropdownRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
        setShowNewCategoryInput(false)
        setNewCategoryName("")
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const currentCategory = categories.find((c) => c.id === currentCategoryId)

  const handleSelectCategory = (categoryId) => {
    onCategoryChange(conversationId, categoryId)
    setIsOpen(false)
  }

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim() || !userId) return

    try {
      const newCategory = await createCategoryClient(userId, newCategoryName.trim())
      handleSelectCategory(newCategory.id)
      setNewCategoryName("")
      setShowNewCategoryInput(false)
    } catch (err) {
      alert(err.message || "Failed to create category")
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cls(
          "inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-800",
          currentCategoryId && "bg-zinc-100 dark:bg-zinc-800"
        )}
      >
        <Tag className="h-3.5 w-3.5" />
        <span className="truncate max-w-[120px]">
          {currentCategory ? currentCategory.name : "Uncategorized"}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-56 rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950 z-50 max-h-64 overflow-y-auto">
          {/* Uncategorized option */}
          <button
            onClick={() => handleSelectCategory(null)}
            className={cls(
              "w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 first:rounded-t-lg",
              !currentCategoryId && "bg-zinc-100 dark:bg-zinc-800"
            )}
          >
            <span>Uncategorized</span>
          </button>

          {/* Existing categories */}
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => handleSelectCategory(category.id)}
              className={cls(
                "w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-zinc-100 dark:hover:bg-zinc-800",
                currentCategoryId === category.id && "bg-zinc-100 dark:bg-zinc-800"
              )}
            >
              <Tag className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{category.name}</span>
            </button>
          ))}

          {/* Create new category */}
          {showNewCategoryInput ? (
            <div className="border-t border-zinc-200 dark:border-zinc-800 p-2">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreateCategory()
                  } else if (e.key === "Escape") {
                    setShowNewCategoryInput(false)
                    setNewCategoryName("")
                  }
                }}
                placeholder="Category name"
                className="w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
                autoFocus
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={handleCreateCategory}
                  className="flex-1 rounded bg-zinc-900 px-2 py-1 text-xs text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setShowNewCategoryInput(false)
                    setNewCategoryName("")
                  }}
                  className="flex-1 rounded border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNewCategoryInput(true)}
              className="w-full flex items-center gap-2 border-t border-zinc-200 px-3 py-2 text-xs text-left hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-800 last:rounded-b-lg"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create new category</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

