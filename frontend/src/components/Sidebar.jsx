import { useState, useMemo, useRef, useEffect } from 'react'
import { MessageSquare, Plus, Trash2, Search, X } from 'lucide-react'
import { useChatStore } from '../store/chatStore'
import { formatTimestamp, truncateText } from '../utils/formatting'
import { useChatCache } from '../hooks/useChatCache'

const Sidebar = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const searchInputRef = useRef(null)
  
  const currentChatId = useChatStore(state => state.currentChatId)
  const setCurrentChat = useChatStore(state => state.setCurrentChat)
  const createNewChat = useChatStore(state => state.createNewChat)
  const deleteChat = useChatStore(state => state.deleteChat)
  const { chats } = useChatCache()

  // Filter chats based on search query
  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats
    
    const query = searchQuery.toLowerCase()
    return chats.filter(chat => {
      // Search in title
      if (chat.title.toLowerCase().includes(query)) return true
      
      // Search in messages
      return chat.messages.some(message => 
        message.content.toLowerCase().includes(query)
      )
    })
  }, [chats, searchQuery])

  // Focus search input when modal opens
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isSearchOpen])

  // Close search on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false)
        setSearchQuery('')
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isSearchOpen])

  const handleNewChat = () => {
    createNewChat()
    setIsSearchOpen(false)
    setSearchQuery('')
  }

  const handleDeleteChat = (e, chatId) => {
    e.stopPropagation()
    if (window.confirm('Are you sure you want to delete this chat?')) {
      deleteChat(chatId)
    }
  }

  const handleChatClick = (chatId) => {
    setCurrentChat(chatId)
    setIsSearchOpen(false)
    setSearchQuery('')
  }

  // Highlight matching text
  const highlightText = (text, query) => {
    if (!query.trim()) return text
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'))
    return parts.map((part, index) => 
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={index} className="bg-cyan-200 dark:bg-cyan-900/50 text-cyan-900 dark:text-cyan-100 rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    )
  }

  return (
    <div className="w-64 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col h-full">
      {/* Header - Chat Label */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Chat</h2>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={handleNewChat}
          className="w-full px-4 py-3 text-left text-sm font-medium text-cyan-600 dark:text-cyan-400 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Chat
        </button>
        
        <button
          onClick={() => setIsSearchOpen(true)}
          className="w-full px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center transition-colors"
        >
          <Search className="w-4 h-4 mr-2" />
          Search Chats
        </button>
      </div>

      {/* Search Modal */}
      {isSearchOpen && (
        <div 
          className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-start justify-center pt-20"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsSearchOpen(false)
              setSearchQuery('')
            }
          }}
        >
          <div className="w-full mx-4 max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 animate-fade-in">
            {/* Modal Header */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Search Chats
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsSearchOpen(false)
                  setSearchQuery('')
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                aria-label="Close search"
              >
                <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* Search Input */}
            <div className="px-4 py-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search chat titles and messages..."
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>
            </div>

            {/* Search Results */}
            <div className="max-h-96 overflow-y-auto border-t border-gray-200 dark:border-gray-700">
              {searchQuery.trim() && filteredChats.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                  No chats found matching "{searchQuery}"
                </div>
              ) : searchQuery.trim() ? (
                <div className="py-2">
                  {filteredChats.map(chat => (
                    <div
                      key={chat.id}
                      onClick={() => handleChatClick(chat.id)}
                      className={`px-4 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                        currentChatId === chat.id ? 'bg-cyan-50 dark:bg-cyan-900/20' : ''
                      }`}
                    >
                      <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {highlightText(chat.title, searchQuery)}
                      </div>
                      {chat.messages.length > 0 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                          {highlightText(
                            truncateText(chat.messages[chat.messages.length - 1].content, 60),
                            searchQuery
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                  Start typing to search your chats...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        <div className="py-2">
          {chats.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
              No chats yet. Start a new conversation!
            </div>
          ) : (
            chats.map(chat => (
              <div
                key={chat.id}
                onClick={() => setCurrentChat(chat.id)}
                className={`px-4 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group ${
                  currentChatId === chat.id ? 'bg-cyan-50 dark:bg-cyan-900/20 border-l-4 border-cyan-600 dark:border-cyan-400' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                      {chat.title}
                    </div>
                    {chat.messages.length > 0 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                        {truncateText(
                          chat.messages[chat.messages.length - 1].content,
                          40
                        )}
                      </div>
                    )}
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {formatTimestamp(chat.createdAt)}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteChat(e, chat.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-opacity"
                    aria-label="Delete chat"
                  >
                    <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default Sidebar
