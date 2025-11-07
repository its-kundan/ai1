import { useState, useRef, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import ChatBubble from './ChatBubble'
import ChatInput from './ChatInput'
import { useChatStore } from '../store/chatStore'
import { generateMockResponse, simulateTyping } from '../utils/mockApi'

const ChatBox = () => {
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [typingMessage, setTypingMessage] = useState(null)
  const [features, setFeatures] = useState({
    ocr: true,
    search: true,
    cdr: false,
    ipdr: false,
    bank: false
  })
  const messagesEndRef = useRef(null)

  const currentChat = useChatStore(state => state.getCurrentChat())
  const addMessage = useChatStore(state => state.addMessage)
  const createNewChat = useChatStore(state => state.createNewChat)
  const clearCurrentChat = useChatStore(state => state.clearCurrentChat)

  const messages = currentChat?.messages || []

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typingMessage])

  // Load features from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('chatgpt-local-features')
      if (stored) {
        setFeatures(JSON.parse(stored))
      }
    } catch (error) {
      console.error('Error loading features:', error)
    }
  }, [])

  // Save features to localStorage
  const handleFeatureChange = (newFeatures) => {
    setFeatures(newFeatures)
    try {
      localStorage.setItem('chatgpt-local-features', JSON.stringify(newFeatures))
    } catch (error) {
      console.error('Error saving features:', error)
    }
  }

  const handleSend = async (message, uploadedFiles = []) => {
    if ((!message.trim() && uploadedFiles.length === 0) || isTyping) return

    const userMessage = message.trim() || (uploadedFiles.length > 0 ? `Uploaded ${uploadedFiles.length} file(s)` : '')
    
    if (userMessage) {
      // Add user message
      addMessage('user', userMessage)
    }

    // If no current chat, create one
    if (!currentChat) {
      createNewChat()
    }

    // Simulate bot response
    setIsTyping(true)
    setTypingMessage({ role: 'assistant', content: '', timestamp: new Date().toISOString() })

    // Show thinking indicator
    await simulateTyping((thinkingText) => {
      if (thinkingText) {
        setTypingMessage({ role: 'assistant', content: thinkingText, timestamp: new Date().toISOString() })
      } else {
        setTypingMessage(null)
      }
    })

    // Generate and add bot response
    const botResponse = await generateMockResponse(userMessage || 'I see you uploaded a file. How can I help you with it?')
    addMessage('assistant', botResponse)
    
    setIsTyping(false)
    setTypingMessage(null)
    setInput('')
  }

  const handleUpload = async (file, response) => {
    // Mock upload handler
    console.log('File uploaded:', file.name, response)
    // In real app, this would call the backend API
    return response
  }

  const handleRunOCR = async (documentId) => {
    // Mock OCR handler
    console.log('Running OCR for document:', documentId)
    // In real app, this would call the OCR API
  }

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear this chat?')) {
      clearCurrentChat()
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <p className="text-lg mb-2 font-medium">Start a conversation</p>
              <p className="text-sm">Type a message below to begin chatting</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map(message => (
              <ChatBubble key={message.id} message={message} />
            ))}
            {typingMessage && (
              <ChatBubble message={typingMessage} isTyping={true} />
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area with ChatInput */}
      <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        {messages.length > 0 && (
          <div className="px-4 pt-3 pb-1 flex justify-end">
            <button
              onClick={handleClear}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Clear chat
            </button>
          </div>
        )}
        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={handleSend}
          onUpload={handleUpload}
          onRunOCR={handleRunOCR}
          features={features}
          onFeatureChange={handleFeatureChange}
          disabled={isTyping}
        />
      </div>
    </div>
  )
}

export default ChatBox
