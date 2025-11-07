// LocalStorage utilities for chat persistence

const CHAT_STORAGE_KEY = 'chatgpt-local-chats'
const CURRENT_CHAT_KEY = 'chatgpt-local-current-chat'

export const storage = {
  // Chat storage
  getChats: () => {
    try {
      const chats = localStorage.getItem(CHAT_STORAGE_KEY)
      return chats ? JSON.parse(chats) : []
    } catch (error) {
      console.error('Error reading chats from storage:', error)
      return []
    }
  },

  saveChats: (chats) => {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chats))
    } catch (error) {
      console.error('Error saving chats to storage:', error)
    }
  },

  getCurrentChatId: () => {
    return localStorage.getItem(CURRENT_CHAT_KEY) || null
  },

  setCurrentChatId: (chatId) => {
    if (chatId) {
      localStorage.setItem(CURRENT_CHAT_KEY, chatId)
    } else {
      localStorage.removeItem(CURRENT_CHAT_KEY)
    }
  },

  clearAll: () => {
    localStorage.removeItem(CHAT_STORAGE_KEY)
    localStorage.removeItem(CURRENT_CHAT_KEY)
  }
}

