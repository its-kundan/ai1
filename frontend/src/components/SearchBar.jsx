import { useState } from 'react'
import { Search, X, FileText, MessageSquare, Loader2 } from 'lucide-react'
import { useSearch } from '../hooks/useSearch'
import { formatTimestamp, truncateText } from '../utils/formatting'
import { useChatStore } from '../store/chatStore'

const SearchBar = () => {
  const { searchQuery, setSearchQuery, searchResults, isSearching, performSearch, clearSearch } = useSearch()
  const setCurrentChat = useChatStore(state => state.setCurrentChat)
  const setActiveTab = useChatStore(state => state.setActiveTab)

  const handleSearch = async (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      await performSearch()
    }
  }

  const handleResultClick = (result) => {
    if (result.type === 'chat') {
      setCurrentChat(result.chatId)
      setActiveTab('chat')
    }
  }

  return (
    <div className="h-full flex flex-col p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">Search</h2>
        <p className="text-gray-600">Search through your chats and uploaded documents</p>
      </div>

      <form onSubmit={handleSearch} className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages and documents..."
            className="w-full pl-12 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={!searchQuery.trim() || isSearching}
          className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {isSearching ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search className="w-5 h-5" />
              Search
            </>
          )}
        </button>
      </form>

      {searchResults.length > 0 && (
        <div className="flex-1 overflow-y-auto">
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-medium text-gray-800">
                Results ({searchResults.length})
              </h3>
            </div>
            <div className="divide-y divide-gray-200">
              {searchResults.map((result, index) => (
                <div
                  key={index}
                  onClick={() => handleResultClick(result)}
                  className={`p-4 hover:bg-gray-50 transition-colors ${
                    result.type === 'chat' ? 'cursor-pointer' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {result.type === 'chat' ? (
                      <MessageSquare className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <FileText className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-800">
                          {result.type === 'chat' ? result.chatTitle : result.filename}
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                          {result.type === 'chat' ? 'Chat' : 'Document'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {truncateText(result.content || result.text, 150)}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatTimestamp(result.timestamp || result.uploadedAt)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {searchQuery && searchResults.length === 0 && !isSearching && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <p className="text-lg mb-2">No results found</p>
            <p className="text-sm">Try a different search query</p>
          </div>
        </div>
      )}

      {!searchQuery && searchResults.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <Search className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg mb-2">Start searching</p>
            <p className="text-sm">Enter a query above to search your chats and documents</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default SearchBar

