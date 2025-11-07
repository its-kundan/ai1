// ID generation utilities

export const generateId = (prefix = 'id') => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export const generateChatId = () => generateId('chat')
export const generateMessageId = () => generateId('msg')

