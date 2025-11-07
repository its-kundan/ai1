import { useState, useMemo } from 'react'
import { useChatStore } from '../store/chatStore'
import mockOCRResults from '../data/mockOCRResults.json'

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

  // Search through OCR results (mock)
  const searchDocuments = async (query) => {
    setIsSearching(true)
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const results = mockOCRResults
      .filter(doc => doc.text.toLowerCase().includes(query.toLowerCase()))
      .map(doc => ({
        type: 'document',
        id: doc.id,
        filename: doc.filename,
        text: doc.text,
        uploadedAt: doc.uploadedAt
      }))
    
    setIsSearching(false)
    return results
  }

  const performSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    
    // Search both chats and documents
    const chatResults = searchChats
    const docResults = await searchDocuments(searchQuery)
    
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

