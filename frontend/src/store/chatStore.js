import { create } from 'zustand'
import { storage } from '../utils/storage'
import { generateChatId, generateMessageId } from '../utils/idGenerator'

export const useChatStore = create((set, get) => ({
  chats: [],
  currentChatId: null,
  activeTab: 'chat', // 'chat', 'upload', 'search'

  // Initialize store from localStorage
  initialize: () => {
    const chats = storage.getChats()
    const currentChatId = storage.getCurrentChatId()
    set({ chats, currentChatId })
  },

  // Set active tab
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Get current chat
  getCurrentChat: () => {
    const { chats, currentChatId } = get()
    return chats.find(chat => chat.id === currentChatId) || null
  },

  // Create new chat
  createNewChat: () => {
    const newChat = {
      id: generateChatId(),
      title: 'New Chat',
      createdAt: new Date().toISOString(),
      messages: []
    }
    
    set(state => {
      const newChats = [newChat, ...state.chats]
      storage.saveChats(newChats)
      storage.setCurrentChatId(newChat.id)
      return {
        chats: newChats,
        currentChatId: newChat.id
      }
    })
    
    return newChat.id
  },

  // Set current chat
  setCurrentChat: (chatId) => {
    storage.setCurrentChatId(chatId)
    set({ currentChatId: chatId })
  },

  // Add message to current chat
  addMessage: (role, content) => {
    const { currentChatId, chats } = get()
    
    if (!currentChatId) {
      // Create new chat if none exists
      const chatId = get().createNewChat()
      set({ currentChatId: chatId })
    }

    const message = {
      id: generateMessageId(),
      role,
      content,
      timestamp: new Date().toISOString()
    }

    set(state => {
      const updatedChats = state.chats.map(chat => {
        if (chat.id === state.currentChatId) {
          // Update title if it's the first user message
          const updatedChat = {
            ...chat,
            messages: [...chat.messages, message]
          }
          if (chat.messages.length === 0 && role === 'user') {
            updatedChat.title = content.slice(0, 50) || 'New Chat'
          }
          return updatedChat
        }
        return chat
      })
      
      storage.saveChats(updatedChats)
      return { chats: updatedChats }
    })

    return message
  },

  // Clear current chat
  clearCurrentChat: () => {
    const { currentChatId, chats } = get()
    if (!currentChatId) return

    set(state => {
      const updatedChats = state.chats.map(chat => {
        if (chat.id === state.currentChatId) {
          return { ...chat, messages: [] }
        }
        return chat
      })
      
      storage.saveChats(updatedChats)
      return { chats: updatedChats }
    })
  },

  // Delete chat
  deleteChat: (chatId) => {
    set(state => {
      const updatedChats = state.chats.filter(chat => chat.id !== chatId)
      storage.saveChats(updatedChats)
      
      // If deleted chat was current, clear current or set to first chat
      const newCurrentChatId = state.currentChatId === chatId
        ? (updatedChats.length > 0 ? updatedChats[0].id : null)
        : state.currentChatId
      
      storage.setCurrentChatId(newCurrentChatId)
      return {
        chats: updatedChats,
        currentChatId: newCurrentChatId
      }
    })
  }
}))

