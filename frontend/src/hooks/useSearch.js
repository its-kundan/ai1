import { useState, useMemo } from 'react'
import { useChatStore } from '../store/chatStore'
import { searchDocuments } from '../utils/api'

export const useSearch = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const chats = useChatStore(state => state.chats)

  // Search through chats
  const searchChats = useMemo(() => {
    if (!searchQuery.trim()) return []

    const query = searchQuery.toLowerCase()
    const results = []

    chats.forEach(chat => {
      chat.messages.forEach(message => {
        if (message.content.toLowerCase().includes(query)) {
          results.push({
            type: 'chat',
            chatId: chat.id,
            chatTitle: chat.title,
            messageId: message.id,
            content: message.content,
            timestamp: message.timestamp
          })
        }
      })
    })

    return results
  }, [searchQuery, chats])

  // Search through documents using API
  const searchDocumentsAPI = async (query) => {
    setIsSearching(true)
    
    try {
      const response = await searchDocuments(query, 10) // top_k = 10
      
      // Transform API response to match expected format
      const results = response.results.map(result => ({
        type: 'document',
        id: result.doc_id,
        doc_id: result.doc_id,
        snippet: result.snippet,
        score: result.score,
        metadata: result.metadata
      }))
      
      setIsSearching(false)
      return results
    } catch (error) {
      console.error('Search failed:', error)
      setIsSearching(false)
      return [] // Return empty array on error
    }
  }

  const performSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    
    // Search both chats and documents
    const chatResults = searchChats
    const docResults = await searchDocumentsAPI(searchQuery)
    
    setSearchResults([...chatResults, ...docResults])
    setIsSearching(false)
  }

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    performSearch,
    clearSearch: () => {
      setSearchQuery('')
      setSearchResults([])
    }
  }
}

