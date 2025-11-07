import { useEffect } from 'react'
import { useChatStore } from '../store/chatStore'

export const useChatCache = () => {
  const initialize = useChatStore(state => state.initialize)
  const chats = useChatStore(state => state.chats)
  const currentChatId = useChatStore(state => state.currentChatId)

  useEffect(() => {
    // Initialize from localStorage on mount
    initialize()
  }, [initialize])

  return {
    chats,
    currentChatId,
    isInitialized: chats.length >= 0
  }
}

