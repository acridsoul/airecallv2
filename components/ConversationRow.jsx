import React, { useState, useRef, useEffect } from "react";
import { Star, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { cls, timeAgo } from "./utils";

export default function ConversationRow({ 
  data, 
  active, 
  onSelect, 
  onTogglePin, 
  showMeta,
  onRename,
  onDelete,
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);
  const count = Array.isArray(data.messages) ? data.messages.length : data.messageCount;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMenu]);

  const handleRename = (e) => {
    e.stopPropagation();
    const newTitle = prompt(`Rename conversation "${data.title}" to:`, data.title);
    if (newTitle && newTitle.trim() && newTitle !== data.title) {
      onRename?.(data.id, newTitle.trim());
    }
    setShowMenu(false);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete "${data.title}"? This action cannot be undone.`)) {
      onDelete?.(data.id);
    }
    setShowMenu(false);
  };

  return (
    <div className="group relative">
      <button
        onClick={onSelect}
        className={cls(
          "-mx-1 flex w-[calc(100%+8px)] items-center gap-2 rounded-lg px-2 py-2 text-left",
          active
            ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800/60 dark:text-zinc-100"
            : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
        )}
        title={data.title}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium tracking-tight">{data.title}</span>
            <span className="shrink-0 text-[11px] text-zinc-500 dark:text-zinc-400">
              {timeAgo(data.updatedAt)}
            </span>
          </div>
          {showMeta && (
            <div className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              {count} messages
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin();
            }}
            title={data.pinned ? "Unpin" : "Pin"}
            className="rounded-md p-1 text-zinc-500 opacity-0 transition group-hover:opacity-100 hover:bg-zinc-200/50 dark:text-zinc-300 dark:hover:bg-zinc-700/60"
            aria-label={data.pinned ? "Unpin conversation" : "Pin conversation"}
          >
            {data.pinned ? (
              <Star className="h-4 w-4 fill-zinc-800 text-zinc-800 dark:fill-zinc-200 dark:text-zinc-200" />
            ) : (
              <Star className="h-4 w-4" />
            )}
          </button>
          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              title="More options"
              className="rounded-md p-1 text-zinc-500 opacity-0 transition group-hover:opacity-100 hover:bg-zinc-200/50 dark:text-zinc-300 dark:hover:bg-zinc-700/60"
              aria-label="More options"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950 z-50">
                <button
                  onClick={handleRename}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 first:rounded-t-lg"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span>Rename</span>
                </button>
                <button
                  onClick={handleDelete}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 text-red-600 dark:text-red-400 last:rounded-b-lg"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </button>

      <div className="pointer-events-none absolute left-[calc(100%+6px)] top-1 hidden w-64 rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-700 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 md:group-hover:block">
        <div className="line-clamp-6 whitespace-pre-wrap">{data.preview}</div>
      </div>
    </div>
  );
}
