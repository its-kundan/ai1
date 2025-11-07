import { MessageSquare, Upload, Search, Plus, Trash2 } from 'lucide-react'
import { useChatStore } from '../store/chatStore'
import { formatTimestamp, truncateText } from '../utils/formatting'
import { useChatCache } from '../hooks/useChatCache'

const Sidebar = () => {
  const activeTab = useChatStore(state => state.activeTab)
  const setActiveTab = useChatStore(state => state.setActiveTab)
  const currentChatId = useChatStore(state => state.currentChatId)
  const setCurrentChat = useChatStore(state => state.setCurrentChat)
  const createNewChat = useChatStore(state => state.createNewChat)
  const deleteChat = useChatStore(state => state.deleteChat)
  const { chats } = useChatCache()

  const handleNewChat = () => {
    createNewChat()
    setActiveTab('chat')
  }

  const handleDeleteChat = (e, chatId) => {
    e.stopPropagation()
    if (window.confirm('Are you sure you want to delete this chat?')) {
      deleteChat(chatId)
    }
  }

  return (
    <div className="w-64 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col h-full">
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'chat'
              ? 'bg-white dark:bg-gray-800 text-cyan-600 dark:text-cyan-400 border-b-2 border-cyan-600 dark:border-cyan-400'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <MessageSquare className="w-4 h-4 inline mr-2" />
          Chat
        </button>
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'upload'
              ? 'bg-white dark:bg-gray-800 text-cyan-600 dark:text-cyan-400 border-b-2 border-cyan-600 dark:border-cyan-400'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <Upload className="w-4 h-4 inline mr-2" />
          Upload
        </button>
        <button
          onClick={() => setActiveTab('search')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'search'
              ? 'bg-white dark:bg-gray-800 text-cyan-600 dark:text-cyan-400 border-b-2 border-cyan-600 dark:border-cyan-400'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <Search className="w-4 h-4 inline mr-2" />
          Search
        </button>
      </div>

      {/* Chat List (only visible when chat tab is active) */}
      {activeTab === 'chat' && (
        <div className="flex-1 overflow-y-auto">
          <button
            onClick={handleNewChat}
            className="w-full px-4 py-3 text-left text-sm font-medium text-cyan-600 dark:text-cyan-400 hover:bg-gray-100 dark:hover:bg-gray-800 border-b border-gray-200 dark:border-gray-800 flex items-center transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Chat
          </button>
          
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
      )}
    </div>
  )
}

export default Sidebar

